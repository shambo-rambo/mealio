export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-headline font-bold text-on-surface mb-2">Privacy Policy</h1>
      <p className="text-sm text-on-surface-variant mb-8">Last updated: April 2026</p>

      <section className="space-y-6 text-on-surface">
        <div>
          <h2 className="text-lg font-semibold mb-2">What Cook is</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Cook is a family meal planning app. It helps you save recipes, plan your week, and
            manage shopping lists with your household.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Information we collect</h2>
          <ul className="list-disc list-inside space-y-1 text-on-surface-variant leading-relaxed">
            <li>Your name and email address when you create an account</li>
            <li>Recipes, meal plans, and shopping lists you create</li>
            <li>Recipe URLs or photos you submit for import</li>
            <li>Push notification tokens if you enable notifications</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">How we use your information</h2>
          <ul className="list-disc list-inside space-y-1 text-on-surface-variant leading-relaxed">
            <li>To provide and personalise the Cook service</li>
            <li>To share data within your family group</li>
            <li>To send push notifications you have opted into</li>
            <li>To process recipe imports using AI (Anthropic Claude)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Third-party services</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Cook uses the following third-party services:
          </p>
          <ul className="list-disc list-inside space-y-1 text-on-surface-variant mt-2 leading-relaxed">
            <li><strong>Anthropic Claude</strong> — AI recipe parsing</li>
            <li><strong>Meta / Instagram oEmbed</strong> — fetching public post metadata for recipe import</li>
            <li><strong>Cloudflare</strong> — hosting and data storage</li>
          </ul>
          <p className="text-on-surface-variant mt-2 leading-relaxed">
            We only access Instagram data when you explicitly submit an Instagram URL for recipe
            import. We do not store Instagram credentials or access private posts.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Data sharing</h2>
          <p className="text-on-surface-variant leading-relaxed">
            We do not sell your data. Data is shared only within your family group and with the
            third-party services listed above as required to operate the app.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Data retention</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Your data is retained for as long as your account is active. You may request deletion
            by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Questions about this policy? Email{' '}
            <a href="mailto:simon.hamblin@gmail.com" className="text-primary underline">
              simon.hamblin@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
