import { Brand, Body, EmergencyButton, Heading, Panel, Screen, SectionTitle, SourceBadge } from '@/ui/components';
export default function HomeScreen() {
  return <Screen><Brand /><SourceBadge /><Heading>Your situation, clearly.</Heading><Body>Texas Hill Country · simulated location</Body><Panel><SectionTitle>Flash flooding scenario</SectionTitle><Body>This is a simulated interface for development. Live official warnings are not connected in this first increment.</Body></Panel><EmergencyButton /><Body>Follow local emergency authorities. ClearPath cannot verify personal safety.</Body></Screen>;
}
