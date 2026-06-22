const steps = [
  {
    step: '01',
    title: 'Create',
    command: 'npx spectrl new power my-spec',
    description:
      'Scaffold a new spec or power in seconds. A manifest and a blank template — ready to fill in.',
  },
  {
    step: '02',
    title: 'Publish',
    command: 'npx spectrl publish',
    description:
      'Push to the registry so others can find and install your specs. Agent configs, testing styles, architecture patterns — whatever is useful.',
  },
  {
    step: '03',
    title: 'Install',
    command: 'npx spectrl install author/spec',
    description:
      "One command. Sets up your project if it isn't already, resolves dependencies, pulls everything into your repo.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          Three commands 👇
        </h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.step} className="flex flex-col gap-4 bg-background p-8">
              <span className="text-xs font-mono text-muted-foreground">{step.step}</span>
              <h3 className="text-base font-medium text-foreground">{step.title}</h3>
              <code className="inline-block rounded-md border bg-card px-3 py-1.5 font-mono text-sm text-foreground">
                {step.command}
              </code>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
