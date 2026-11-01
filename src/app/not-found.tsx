import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you are looking for does not exist or you do not have access to it.</p>
      <div className="mt-6 flex justify-center">
        <LinkButton href="/">Back to home</LinkButton>
      </div>
    </main>
  );
}
