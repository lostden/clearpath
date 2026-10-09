import { Body, Heading, Panel, Screen, SectionTitle } from '@/ui/components';
import { checklistItems } from '@/data/preparedness';
export default function PrepareScreen() {
  return <Screen><Heading>A little preparation.</Heading><Body>Emergency essentials, available offline.</Body><Panel><SectionTitle>Your essentials</SectionTitle>{checklistItems.map(item => <Body key={item.id}>{item.title}</Body>)}</Panel></Screen>;
}
