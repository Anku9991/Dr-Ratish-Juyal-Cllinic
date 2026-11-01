import { LinkButton } from "./ui";

/** Embeds the access-controlled PDF endpoint. The file is never publicly addressable. */
export function PdfViewer({ prescriptionId }: { prescriptionId: string }) {
  const src = `/api/prescriptions/${prescriptionId}/pdf`;
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2">
        <LinkButton href={`${src}?download=1`} variant="primary">
          Download PDF
        </LinkButton>
        <LinkButton href={src} variant="secondary">
          Open in new tab
        </LinkButton>
      </div>
      <iframe title="Prescription PDF" src={src} className="h-[75vh] w-full rounded-[14px] border border-line bg-white" />
      <p className="text-xs text-muted">If the preview does not appear on your phone, use Download PDF.</p>
    </div>
  );
}
