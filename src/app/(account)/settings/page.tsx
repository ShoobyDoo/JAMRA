export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">Appearance</h2>
          <p className="text-slate-400 text-sm mb-2">
            Customize how the app looks and feels.
          </p>
          <div className="flex items-center gap-4">
            <button className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
              Dark mode
            </button>
            <button className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
              Light mode
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Account</h2>
          <p className="text-slate-400 text-sm mb-2">
            Manage your profile and authentication settings.
          </p>
          <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500">
            Delete account
          </button>
        </section>
      </div>
    </div>
  );
}
