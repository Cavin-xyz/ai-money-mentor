import './index.css'
import { MotionConfig } from 'framer-motion'
import { ProfileProvider } from './context/ProfileContext'
import { LanguageProvider } from './context/LanguageContext'
import Navbar from './components/Navbar'
import HeroSection from './components/HeroSection'
import ProfileBanner from './components/ProfileBanner'
import FeatureBentoGrid from './components/FeatureBentoGrid'
import FirePathPlanner from './components/FirePathPlanner'
import MoneyHealthScore from './components/MoneyHealthScore'
import SchemesForYou from './components/SchemesForYou'
import TaxWizard from './components/TaxWizard'
import LifeEventAdvisor from './components/LifeEventAdvisor'
import CouplesMoneyPlanner from './components/CouplesMoneyPlanner'
import PortfolioXRay from './components/PortfolioXRay'
import ScamShield from './components/ScamShield'
import FooterCTA from './components/FooterCTA'
import ProfileDrawer from './components/ProfileDrawer'

function App() {
  return (
    <ProfileProvider>
      <LanguageProvider>
      <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-hidden">
        <Navbar />
        <main>
          <HeroSection />
          <ProfileBanner />
          <FeatureBentoGrid />
          <FirePathPlanner />
          <MoneyHealthScore />
          <SchemesForYou />
          <TaxWizard />
          <LifeEventAdvisor />
          <CouplesMoneyPlanner />
          <PortfolioXRay />
          <ScamShield />
        </main>
        <FooterCTA />
        <ProfileDrawer />
      </div>
      </MotionConfig>
      </LanguageProvider>
    </ProfileProvider>
  )
}

export default App
