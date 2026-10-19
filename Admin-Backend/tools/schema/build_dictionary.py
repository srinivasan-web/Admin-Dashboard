"""Build Excel-friendly, field-level schema reports from source XLSX and DB metadata.

Inputs are read only. Generated CSV/Markdown under docs/schema/phase-2 are artifacts.
The database snapshot is collected separately by export-schema.php.
"""

import csv
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

BACKEND = Path(__file__).resolve().parents[2]
DOCUMENTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/mnt/c/Users/acer/Downloads')
SCRATCH_METADATA = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('/tmp/durafit-schema-scratch-metadata.json')
RUNTIME_METADATA = Path(sys.argv[3]) if len(sys.argv) > 3 else Path('/tmp/durafit-schema-runtime-metadata.json')
OUTPUT = BACKEND / 'docs/schema/phase-2'
OUTPUT.mkdir(parents=True, exist_ok=True)
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REFERENCE = 'Table-Design (1).xlsx'
SHEET_PREFIX = {
    'Additional benefits': 'product_additional_benefits',
    'EMI CALCULATOR': 'emi_calculations',
    'CHECK DELIVERY DATE': 'delivery_serviceability',
    'Product Comparision': 'product_comparisons',
    'PRODUCT HIGHLIGHTS': 'product_highlights',
    'PRODUCT SPECIFICATIONS': 'product_attributes',
    'User Table': 'users',
    'Brand': 'brands',
    'Products': 'products',
    'Categories': 'categories',
    'Product_images': 'product_images',
    'Product_prices': 'product_prices',
    'Product_types': 'product_types',
    'Product_highlights': 'product_highlights',
    'Product_specifications': 'product_attributes',
    'Specification_definitions': 'attributes',
    'Category_product_listing': 'category_product_listings',
    'Product_details': 'product_details',
    'Product_additional_details': 'product_additional_details',
    'Why_choose_us': 'why_choose_us',
    'Shop_benefits': 'shop_benefits',
    'Customer_addresses': 'customer_addresses',
    'Variant_options': 'variant_options',
    'Product_variants': 'product_variants',
}
TABLE_ALIASES = {
    'category_product_listing': 'category_product_listings',
    'product_specifications': 'product_attributes',
    'specification_definitions': 'attributes',
    'product_comparision': 'product_comparisons',
    'category_bestsellers': 'merchandising_products',
    'category_filters': 'category_filters',
    'category_filter_options': 'category_filter_options',
    'hsn_codes': 'hsn_codes',
    'badges': 'badges',
    'emi_plans': 'emi_plans',
}
FIELD_ALIASES = {
    ('product_attributes', 'specification_definition_id'): 'attribute_id',
    ('category_specifications', 'specification_definition_id'): 'attribute_id',
    ('product_prices', 'starts_at'): 'effective_at',
    ('product_additional_benefits', 'icon_media_id'): 'icon_media_id',
    ('customer_addresses', 'full_name'): 'name',
    ('customer_addresses', 'mobile_number'): 'phone',
    ('customer_addresses', 'address_line_1'): 'address',
    ('customer_addresses', 'pincode'): 'postal_code',
    ('customer_addresses', 'city_id'): 'city',
    ('customer_addresses', 'state_id'): 'state',
    ('product_highlights', 'highlight'): 'product_attribute_id',
    ('categories', 'image_path'): 'image_media_id',
}
OWNER = {
    'products': 'Catalogue manager', 'product_prices': 'Catalogue price action',
    'product_attributes': 'Catalogue manager', 'product_highlights': 'Catalogue manager',
    'attributes': 'Catalogue manager', 'category_specifications': 'Catalogue manager',
    'warehouse_stocks': 'Inventory action', 'stock_movements': 'Inventory action',
    'stock_reservations': 'Order inventory service',
    'orders': 'Order service', 'order_items': 'Order service',
    'order_addresses': 'Order service (snapshot)',
    'payments': 'Payment action', 'customer_addresses': 'Customer',
    'customers': 'Customer', 'shop_benefits': 'Content manager',
    'why_choose_us': 'Content manager',
}
PURPOSE = {
    'id': 'Stable row identifier', 'product_id': 'Owning or referenced product',
    'category_id': 'Category reference', 'brand_id': 'Brand reference',
    'product_type_id': 'Product type reference', 'hsn_code_id': 'HSN tax classification reference',
    'attribute_id': 'Reusable specification definition',
    'product_attribute_id': 'Selected product specification; value lives on product_attributes',
    'media_id': 'Stored media reference', 'icon_media_id': 'Optional icon media reference',
    'image_media_id': 'Presentation image media reference',
    'sort_order': 'Display position', 'is_active': 'Publication or enabled flag',
    'created_at': 'Row creation timestamp', 'updated_at': 'Last row modification timestamp',
    'deleted_at': 'Soft deletion timestamp', 'name': 'Display name',
    'slug': 'URL-friendly identifier', 'description': 'Detailed customer-facing copy',
    'short_description': 'Short customer-facing summary', 'title': 'Display heading',
    'content': 'Detailed structured page content',
    'alt_text': 'Accessible image alternative text',
    'warehouse_id': 'Owning or allocated warehouse',
    'customer_id': 'Owning customer', 'order_id': 'Owning order',
    'order_item_id': 'Owning order line', 'quantity': 'Physical or line quantity',
    'reserved_quantity': 'Quantity held for active reservations',
    'quantity_delta': 'Signed stock movement', 'value': 'Specification display value',
    'is_primary': 'Primary gallery image selection',
    'is_filterable': 'Controls specification filter eligibility',
    'is_comparable': 'Controls comparison eligibility',
    'is_required': 'Category validation requirement, when enabled',
    'is_featured': 'Curated category placement flag',
    'amount': 'Exact decimal money amount', 'currency': 'ISO currency code',
    'mrp_price': 'Current listed maximum retail price',
    'sale_price': 'Current discounted price; null means no sale price',
    'discount_amount': 'Order or line discount snapshot',
    'tax_amount': 'Order or line tax snapshot; null means unknown',
    'unit_price': 'Order line unit-price snapshot',
    'line_total': 'Order line total-price snapshot',
    'postal_code': 'Delivery postal code', 'status': 'Lifecycle status',
    'is_trade_product': 'Trade product classification',
    'is_active': 'Enabled or published state',
    'created_by': 'Actor responsible for creation or movement',
    'idempotency_key': 'Replay protection for one operation',
}


def workbook_sheets(filename):
    with zipfile.ZipFile(DOCUMENTS / filename) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        links = {item.attrib['Id']: item.attrib['Target'] for item in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        for sheet in ET.fromstring(archive.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
            path = links[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            path = path.lstrip('/') if path.startswith('/') else 'xl/' + path
            rows = {}
            for row in ET.fromstring(archive.read(path)).findall('m:sheetData/m:row', NS):
                cells = {}
                for cell in row:
                    node = cell.find('m:v', NS)
                    inline = cell.find('m:is', NS)
                    value = node.text if node is not None else ''.join(inline.itertext()) if inline is not None else ''
                    if cell.attrib.get('t') == 's':
                        value = shared[int(value)]
                    if value:
                        cells[cell.attrib['r']] = value.strip()
                rows[int(row.attrib['r'])] = cells
            yield sheet.attrib['name'], rows


def col_index(text):
    result = 0
    for char in text:
        result = result * 26 + ord(char) - 64
    return result


def col_name(index):
    result = ''
    while index:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def canonical_table(raw):
    raw = raw.strip()
    if raw in SHEET_PREFIX:
        return SHEET_PREFIX[raw]
    value = re.sub(r'[^a-z0-9]+', '_', raw.lower()).strip('_')
    return TABLE_ALIASES.get(value, value)


def workbook_fields():
    found = []
    for sheet, rows in workbook_sheets(REFERENCE):
        for number, cells in rows.items():
            for coordinate, value in cells.items():
                if value.lower() != 'column name':
                    continue
                base = re.match(r'[A-Z]+', coordinate).group()
                number_col = col_index(base)
                heading = ''
                for previous in range(number - 1, max(0, number - 5), -1):
                    candidate = rows.get(previous, {}).get(f'{base}{previous}', '')
                    if candidate and candidate.lower() != 'column name':
                        heading = candidate
                        break
                if not heading:
                    continue
                table = canonical_table(heading)
                count = 0
                for current in range(number + 1, max(rows) + 1):
                    field = rows.get(current, {}).get(f'{base}{current}', '').strip()
                    if not field:
                        break
                    if not re.fullmatch(r'[a-z][a-z0-9_]*', field):
                        break
                    def near(offset):
                        return rows.get(current, {}).get(f'{col_name(number_col + offset)}{current}', '')
                    found.append({
                        'sheet': sheet, 'table': table, 'source_table': heading,
                        'field': field, 'source_cell': f'{base}{current}',
                        'data_type': near(1), 'nullable': near(2),
                        'key': near(3), 'purpose': near(4),
                    })
                    count += 1
    return found


def write_csv(path, headers, rows):
    with (OUTPUT / path).open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def entries(value):
    return value.values() if isinstance(value, dict) else value


def main():
    scratch = json.loads(SCRATCH_METADATA.read_text())
    runtime = json.loads(RUNTIME_METADATA.read_text())
    reference = workbook_fields()
    write_csv('reference-fields.csv', list(reference[0]), reference)
    by_target = {}
    for source in reference:
        table = source['table']
        field = FIELD_ALIASES.get((table, source['field']), source['field'])
        by_target.setdefault((table, field), []).append(source)

    mappings = []
    for source in reference:
        target_table = source['table']
        target_field = FIELD_ALIASES.get((target_table, source['field']), source['field'])
        target_columns = {column['name'] for column in scratch['tables'].get(target_table, {}).get('columns', [])}
        runtime_columns = {column['name'] for column in runtime['tables'].get(target_table, {}).get('columns', [])}
        state = 'not implemented'
        if target_field in runtime_columns:
            state = 'existing'
        elif target_field in target_columns:
            state = 'pending migration'
        if target_field != source['field'] and state != 'not implemented':
            state += '; renamed/equivalent (verify semantics)'
        mappings.append({
            'source_sheet': source['sheet'], 'source_cell': source['source_cell'],
            'source_table': source['source_table'], 'source_field': source['field'],
            'target_table': target_table, 'target_field': target_field, 'state': state,
            'source_type': source['data_type'], 'source_purpose': source['purpose'],
        })
    write_csv('source-to-schema.csv', list(mappings[0]), mappings)

    report = []
    inventory = []
    entities = set(scratch['tables']) | {row['table'] for row in reference}
    for table in sorted(entities):
        projected = scratch['tables'].get(table)
        live = runtime['tables'].get(table)
        if projected is None:
            inventory.append({'table': table, 'state': 'reference only', 'fields': len([x for x in reference if x['table'] == table]), 'owner': OWNER.get(table, 'Domain owner to confirm'), 'purpose': 'Documented workbook entity; no migration'})
            continue
        inventory.append({'table': table, 'state': 'applied' if live else 'pending migration', 'fields': len(projected['columns']), 'owner': OWNER.get(table, 'Domain owner to confirm'), 'purpose': 'Existing relational record' if live else 'Proposed storefront schema record'})
        fk = {column for key in entries(projected['foreign_keys']) for column in key['columns']}
        index = {column for entry in entries(projected['indexes']) for column in entry['columns']}
        unique = {column for entry in entries(projected['indexes']) if entry.get('unique') for column in entry['columns']}
        for column in projected['columns']:
            name = column['name']
            sources = by_target.get((table, name), [])
            source = sources[0] if sources else None
            fk_entry = next((entry for entry in entries(projected['foreign_keys']) if name in entry['columns']), None)
            target = ''
            delete = ''
            if fk_entry:
                target = fk_entry['foreign_table'] + '.' + fk_entry['foreign_columns'][fk_entry['columns'].index(name)]
                delete = fk_entry['on_delete'] + ' / ' + fk_entry['on_update']
            dtype = column['type']
            purpose = source['purpose'] if source and source['purpose'] and source['purpose'] not in ('-', '—') else PURPOSE.get(name)
            if not purpose:
                purpose = name.replace('_', ' ').capitalize() + ' for ' + table.replace('_', ' ')
            example = ('NULL (unknown)' if column['nullable'] else 'Required')
            if name in ('is_active', 'is_primary', 'is_filterable', 'is_required', 'is_comparable'):
                example = '0 or 1'
            elif name in ('sort_order', 'quantity', 'reserved_quantity'):
                example = '0'
            elif name.endswith('_amount') or name in ('amount', 'mrp_price', 'sale_price', 'unit_price'):
                example = '12999.00'
            elif name == 'currency':
                example = 'INR'
            if name == 'id' or dtype.startswith('char(36)'):
                example = 'UUID (synthetic)'
            report.append({
                'Table': table, 'Column Name': name, 'Data Type': dtype,
                'Nullable': 'YES' if column['nullable'] else 'NO',
                'Key': ', '.join(part for part, yes in [('PK', name == 'id' and any(i.get('primary') and name in i['columns'] for i in entries(projected['indexes']))), ('FK', name in fk), ('UNIQUE', name in unique), ('INDEX', name in index)] if yes),
                'Purpose': purpose, 'Default': column['default'] if column['default'] is not None else 'NULL / none',
                'FK Target': target, 'Delete/Update Rule': delete,
                'Validation': 'FK existence/ownership' if fk_entry else 'See active Laravel request/action; not defined for proposed fields',
                'Example Value': example,
                'Customer Use Case': ('Show or buy an eligible product' if table.startswith(('product', 'category', 'attribute', 'brand')) else 'Preserve a valid customer purchase and history' if table.startswith(('order', 'payment', 'shipment', 'customer', 'stock', 'warehouse')) else 'Display the configured storefront content'),
                'Data Owner': OWNER.get(table, 'Domain owner to confirm'),
                'Stored/Derived': 'Derived' if column.get('generation') else 'Stored',
                'API Exposure': 'Existing public ProductResource' if table == 'products' and name in {'id', 'name', 'sku', 'description', 'mrp_price', 'sale_price'} else 'No public contract confirmed',
                'Source Reference': f"{source['sheet']}!{source['source_cell']}" if source else 'Existing migration / repository schema',
                'Schema State': 'applied in local MySQL' if live and name in {x['name'] for x in live['columns']} else 'pending migration',
            })
    write_csv('data-dictionary.csv', list(report[0]), report)
    write_csv('entity-register.csv', list(inventory[0]), inventory)

    lines = ['erDiagram']
    for table, spec in sorted(scratch['tables'].items()):
        if table in {'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sessions', 'password_reset_tokens'}:
            continue
        for fk in entries(spec['foreign_keys']):
            lines.append(f"    {fk['foreign_table']} ||--o{{ {table} : \"{','.join(fk['columns'])}\"")
    (OUTPUT / 'erd.mmd').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(reference)} workbook fields; {len(report)} projected fields across {len(scratch["tables"])} tables; {sum(1 for row in mappings if row["state"] == "not implemented")} reference fields not implemented.')


if __name__ == '__main__':
    main()
