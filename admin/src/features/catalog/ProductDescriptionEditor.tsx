import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { AlertCircle, FileText, RotateCcw } from "lucide-react";
import { descriptionAsEditorHtml } from "../../../../shared/productDescription";
import "./productDescriptionEditor.css";

const DescriptionDocument = lazy(() => import("./ProductDescriptionDocument"));

class EditorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ProductDescriptionEditor({
  initialValue,
  onEdit,
}: {
  initialValue: string;
  onEdit?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [attempt, setAttempt] = useState(0);
  const [Document, setDocument] = useState(() => DescriptionDocument);
  const preview = (
    <div
      className="description-preserved"
      dangerouslySetInnerHTML={{ __html: descriptionAsEditorHtml(value) }}
    />
  );
  return (
    <div className="description-workspace">
    
      <EditorBoundary
        key={attempt}
        fallback={
          <div className="description-recovery" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <strong>The description editor couldn’t load.</strong>
              <p>
                Your current description is retained. Retry to continue editing.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDocument(() =>
                    lazy(() => import("./ProductDescriptionDocument")),
                  );
                  setAttempt((number) => number + 1);
                }}
              >
                <RotateCcw size={15} aria-hidden="true" /> Retry editor
              </button>
            </div>
            {preview}
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="description-loading">
              <p role="status">Opening description editor…</p>
              {preview}
            </div>
          }
        >
          <Document
            initialValue={value}
            onChange={(html) => {
              setValue(html);
              onEdit?.();
            }}
          />
        </Suspense>
      </EditorBoundary>
      <input type="hidden" name="description" value={value} readOnly />
    </div>
  );
}
