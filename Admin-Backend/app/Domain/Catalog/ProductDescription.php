<?php

namespace App\Domain\Catalog;

use DOMDocument;
use DOMElement;
use DOMNode;

final class ProductDescription
{
    private const ALLOWED = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'a'];

    private const DISCARD = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'template', 'link', 'meta'];

    public static function clean(?string $value): ?string
    {
        if ($value === null || ! preg_match('/<\/?[a-z]/i', $value)) {
            return $value;
        }
        $source = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        try {
            $source->loadHTML('<?xml encoding="UTF-8"><html><body>'.$value.'</body></html>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            $target = new DOMDocument('1.0', 'UTF-8');
            $root = $target->appendChild($target->createElement('div'));
            foreach ($source->getElementsByTagName('body')->item(0)?->childNodes ?? [] as $child) {
                self::copy($child, $root, $target);
            }
            $html = '';
            foreach ($root->childNodes as $child) {
                $html .= $target->saveHTML($child);
            }

            return $html;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }

    private static function copy(DOMNode $source, DOMNode $destination, DOMDocument $target): void
    {
        if ($source->nodeType === XML_TEXT_NODE) {
            $destination->appendChild($target->createTextNode($source->textContent));

            return;
        }
        if (! $source instanceof DOMElement) {
            return;
        }
        $tag = strtolower($source->tagName);
        if (in_array($tag, self::DISCARD, true)) {
            return;
        }
        $parent = $destination;
        if (in_array($tag, self::ALLOWED, true)) {
            $parent = $destination->appendChild($target->createElement($tag === 'div' ? 'p' : $tag));
            $href = trim($source->getAttribute('href'));
            if ($tag === 'a' && preg_match('~^https?://~i', $href) && filter_var($href, FILTER_VALIDATE_URL)) {
                $parent->setAttribute('href', $href);
                $parent->setAttribute('rel', 'noopener noreferrer');
                $parent->setAttribute('target', '_blank');
            }
        }
        foreach ($source->childNodes as $child) {
            self::copy($child, $parent, $target);
        }
    }
}
