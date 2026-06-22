import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Hero } from '@/components/landing/hero';
import { CliDemo } from '@/components/landing/cli-demo';
import { Features } from '@/components/landing/features';
import { HowItWorks } from '@/components/landing/how-it-works';
import { InstallCta } from '@/components/landing/install-cta';

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <CliDemo />
        <Features />
        <HowItWorks />
        <InstallCta />
      </main>
      <SiteFooter />
    </div>
  );
}
