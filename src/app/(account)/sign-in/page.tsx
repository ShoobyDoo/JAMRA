export default function SignInPage() {
  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <form className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-slate-400 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-md border border-slate-800 bg-content px-3 py-2 text-sm text-primary placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm text-slate-400 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-md border border-slate-800 bg-content px-3 py-2 text-sm text-primary placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Sign in
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Don't have an account?{" "}
        <a href="#" className="text-accent hover:underline">
          Create account
        </a>
      </p>
    </div>
  );
}
