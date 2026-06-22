import { HardDrive, Fingerprint, Blocks, Bot, Users } from 'lucide-react';

const features = [
  {
    icon: HardDrive,
    title: 'Local-first',
    description:
      'No account needed to start. Specs live in your repo, version-controlled alongside the code they describe.',
  },
  {
    icon: Fingerprint,
    title: 'Reproducible',
    description:
      'Every spec version is content-hashed. What you install today is exactly what you install tomorrow.',
  },
  {
    icon: Blocks,
    title: 'Composable',
    description:
      'Specs can depend on other specs. Your API contract can pull in a shared error format.',
  },
  {
    icon: Bot,
    title: 'Agent-readable',
    description:
      'Structured enough for AI agents to parse and act on. Give your tools real context, not guesswork.',
  },
  {
    icon: Users,
    title: 'Shareable',
    description:
      'Publish specs to the public registry. Testing philosophies, code style guides, agent configs — share what works for you.',
  },
];

export function Features() {
  return (
    <section className="border-t px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          What it does
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted-foreground leading-relaxed">
          Specs that are as easy to manage as packages. Local or shared. Human-readable and
          machine-parseable.
        </p>
        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-3">
              <div className="flex size-9 items-center justify-center rounded-md border bg-card">
                <feature.icon className="size-4 text-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
