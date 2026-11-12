/** Collection book stamps. Each is earned once. */
export interface StampDef {
  id: string;
  title: string;
  hint: string;
  icon: string;
}

export const STAMPS: StampDef[] = [
  { id: 'harvest-potato', title: 'First Spuds', hint: 'Harvest Space Potatoes', icon: '🥔' },
  { id: 'harvest-lettuce', title: 'Leafy Greens', hint: 'Harvest Grow Light Lettuce', icon: '🥬' },
  { id: 'harvest-strawberry', title: 'Berry Nice', hint: 'Harvest Moon Strawberries', icon: '🍓' },
  { id: 'harvest-pumpkin', title: 'Pumpkin Glow', hint: 'Harvest Starlight Pumpkins', icon: '🎃' },
  { id: 'build-solar', title: 'Here Comes the Sun', hint: 'Build a Solar Farm', icon: '☀️' },
  { id: 'build-greenhouse', title: 'Green Thumb', hint: 'Build a second Greenhouse', icon: '🌱' },
  { id: 'build-galley', title: 'Diner Time', hint: 'Build the Galley', icon: '🍳' },
  { id: 'upgrade-any', title: 'Shiny and New', hint: 'Upgrade any module', icon: '🔧' },
  { id: 'max-level', title: 'Top of the Line', hint: 'Get a module to level 5', icon: '🏆' },
  { id: 'rocket-landed', title: 'Special Delivery', hint: 'Unload your first rocket', icon: '🚀' },
  { id: 'liftoff-smooth', title: 'Smooth Operator', hint: 'Fly a near perfect Liftoff', icon: '🎯' },
  { id: 'real-launch', title: 'Watching the Skies', hint: 'Catch a real rocket launch', icon: '📡' },
  { id: 'meal-cooked', title: 'Chef of the Moon', hint: 'Cook a meal in the Galley', icon: '🍽️' },
  { id: 'all-cheery', title: 'Happy Crew', hint: 'Get all three crew Cheery at once', icon: '😊' },
  { id: 'rockets-10', title: 'Frequent Flyer', hint: 'Land 10 rockets', icon: '🛰️' },
];
