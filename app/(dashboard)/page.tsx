import ClientList from "@/components/ClientList";

export const dynamic = "force-dynamic";

export default function LogbookPage() {
  return (
    <div className="h-full flex flex-col" style={{ height: "calc(100vh - 97px)" }}>
      <div
        className="px-6 pt-5 pb-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          The <em>logbook</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          Client records across all EPIC Menswear locations
        </p>
      </div>
      <ClientList initialBranch="All" />
    </div>
  );
}
