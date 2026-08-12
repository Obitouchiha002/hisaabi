/**
 * Roz ka paisa-quote — asli mahaan logo ke, chhote aur dum-daar. Home pe
 * dikhta hai. Din ke hisaab se badalta hai (deterministic — koi random nahi).
 */
export interface Quote { text: string; author: string }

const QUOTES: Quote[] = [
  { text: "Do not save what is left after spending; spend what is left after saving.", author: 'Warren Buffett' },
  { text: 'Beware of little expenses — a small leak will sink a great ship.', author: 'Benjamin Franklin' },
  { text: "It's not how much money you make, but how much you keep.", author: 'Robert Kiyosaki' },
  { text: 'A budget is telling your money where to go instead of wondering where it went.', author: 'John C. Maxwell' },
  { text: 'Rule No. 1: never lose money. Rule No. 2: never forget Rule No. 1.', author: 'Warren Buffett' },
  { text: 'If you buy things you do not need, soon you will sell things you need.', author: 'Warren Buffett' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Never spend your money before you have earned it.', author: 'Thomas Jefferson' },
  { text: 'Wealth is not having great possessions, but having few wants.', author: 'Epictetus' },
  { text: 'The habit of saving is itself an education.', author: 'T.T. Munger' },
  { text: 'Someone is sitting in the shade today because someone planted a tree long ago.', author: 'Warren Buffett' },
  { text: 'Price is what you pay. Value is what you get.', author: 'Warren Buffett' },
  { text: 'Live on less than you make — that is financial peace.', author: 'Dave Ramsey' },
  { text: 'The quickest way to double your money is to fold it and put it back in your pocket.', author: 'Will Rogers' },
  { text: 'Money is a terrible master but an excellent servant.', author: 'P.T. Barnum' },
  { text: 'A penny saved is a penny earned.', author: 'Benjamin Franklin' },
  { text: "Don't tell me what you value — show me your budget.", author: 'Joe Biden' },
  { text: 'The art is not in making money, but in keeping it.', author: 'Proverb' },
  { text: 'Frugality includes all the other virtues.', author: 'Cicero' },
  { text: 'Save money and money will save you.', author: 'Proverb' },
  { text: 'The more you learn, the more you earn.', author: 'Warren Buffett' },
  { text: 'Compound interest is the eighth wonder of the world.', author: 'Albert Einstein' },
  { text: 'Every rupee you save today is a free rupee tomorrow.', author: 'Naval Ravikant' },
  { text: 'Being rich is having money; being wealthy is having time.', author: 'Stephen Swid' },
  { text: 'Spend less than you earn, invest the difference — repeat.', author: 'The Millionaire Next Door' },
];

/** Aaj ka quote — din ke hisaab se badalta hai. */
export function todayQuote(now = new Date()): Quote {
  const dayIndex = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayIndex % QUOTES.length];
}
