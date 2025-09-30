export default function ProfilePage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">User Information</h2>
          <p className="text-slate-400 text-sm mb-2">
            View and edit your personal details.
          </p>
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <p className="text-slate-200">
              Username: <span className="font-mono">Guest</span>
            </p>
            <p className="text-slate-200">
              Email: <span className="font-mono">guest@example.com</span>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Preferences</h2>
          <p className="text-slate-400 text-sm mb-2">
            Adjust your reading and notification preferences.
          </p>
          <button className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
            Edit preferences
          </button>
        </section>
      </div>
    </div>
  );
}
