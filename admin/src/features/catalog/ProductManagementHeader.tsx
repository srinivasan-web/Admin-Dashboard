import type { ReactNode } from "react";
import { PageHeader } from "../../components/ui/PageHeader";

export function ProductManagementHeader({
  title,
  description,
  actions,
  breadcrumb = ["Product Management", title],
  eyebrow,
  showBreadcrumb = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: string[];
  eyebrow?: string;
  showBreadcrumb?: boolean;
}) {
  return showBreadcrumb ? (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      breadcrumb={breadcrumb}
      eyebrow={eyebrow}
    />
  ) : (
    <div className="workspace-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="page-intro">{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}
