import { auth } from "@/auth";
import Navbar from "@/components/Navbar";
import JobList from "@/components/JobList";
import NewJobForm from "@/components/NewJobForm";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              {role === "SUPPLIER" ? "Jobs to edit" : "Jobs"}
            </h1>
            <p className="text-sm text-ink-soft">
              {role === "OWNER" && "Everything moving through the desk."}
              {role === "CONTRACTOR" && "Jobs you've submitted."}
              {role === "SUPPLIER" && "Assigned to you."}
            </p>
          </div>
          {(role === "OWNER" || role === "CONTRACTOR") && <NewJobForm />}
        </div>
        <JobList />
      </main>
    </>
  );
}
