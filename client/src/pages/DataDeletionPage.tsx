export function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-surface px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-headline font-bold text-on-surface mb-2">Data Deletion</h1>
      <p className="text-sm text-on-surface-variant mb-8">How to request deletion of your Food Prep data</p>

      <section className="space-y-6 text-on-surface">
        <div>
          <h2 className="text-lg font-semibold mb-2">What data we hold</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Food Prep stores your account details (name, email), your family group, recipes, meal
            plans, and shopping lists. We do not store Facebook or Instagram credentials — we only
            use Instagram's public oEmbed API to fetch metadata for recipe URLs you submit.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">How to delete your data</h2>
          <p className="text-on-surface-variant leading-relaxed mb-3">
            To have all your Food Prep data permanently deleted, send an email to:
          </p>
          <a
            href="mailto:simon.hamblin@gmail.com?subject=Food%20Prep%20data%20deletion%20request"
            className="inline-block px-5 py-3 rounded bg-primary text-on-primary font-medium text-sm"
          >
            simon.hamblin@gmail.com
          </a>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            Include the email address associated with your Food Prep account. We will permanently
            delete your account and all associated data within 30 days and confirm by reply.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Instagram data</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Food Prep uses Meta's Instagram oEmbed API solely to fetch the caption and author name of
            public Instagram posts when you choose to import a recipe from an Instagram URL. We do
            not store any Instagram user data beyond what is needed to parse the recipe at the time
            of import.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Response time</h2>
          <p className="text-on-surface-variant leading-relaxed">
            Deletion requests are processed within 30 days. You will receive a confirmation email
            once your data has been removed.
          </p>
        </div>
      </section>
    </div>
  )
}
