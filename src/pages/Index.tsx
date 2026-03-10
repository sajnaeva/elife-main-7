import { Layout } from "@/components/layout/Layout";
import { HeroSection } from "@/components/home/HeroSection";
import { CheckStatusSection } from "@/components/home/CheckStatusSection";
import { AboutSection } from "@/components/home/AboutSection";
import { DivisionsSection } from "@/components/home/DivisionsSection";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <CheckStatusSection />
      <DivisionsSection />
      <AboutSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
