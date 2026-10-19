import { LockKeyhole } from "lucide-react";
import { unavailableModules, type AdminView } from "./AdminSidebar";

export function UnavailableModulePage({ view }: { view: AdminView }) {
  const module = unavailableModules[view];
  if (!module) return null;
  return (
    <section className="workspace-list">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>Operations</span>
        <span aria-hidden="true">/</span>
        <strong>{module.title}</strong>
      </nav>
      <div className="workspace-header">
        <div>
          <h1>{module.title}</h1>
          <p className="page-intro">{module.description}</p>
        </div>
      </div>
      <section className="card unavailable-module">
        <LockKeyhole size={24} aria-hidden="true" />
        <div>
          <h2>Backend contract required</h2>
          <p className="content-copy">{module.requirement}</p>
          <p className="record-count">
            This navigation entry is intentional, but no actions are available
            until the Laravel/API contract is implemented and tested.
          </p>
        </div>
      </section>
    </section>
  );
}
