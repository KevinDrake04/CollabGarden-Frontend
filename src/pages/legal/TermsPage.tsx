import { LegalDocument, type LegalSection } from "./LegalDocument";

const sections: LegalSection[] = [
  {
    heading: "1. Who we are.",
    body: 'CollabGarden NJ ("we", "us") is a product of The Small Business Supporter Initiative. These Terms apply when you use our website. If you do not agree, please do not use it. Contact us at collabgardennj@gmail.com.',
  },
  {
    heading: "2. What CollabGarden is.",
    body: "CollabGarden NJ is a website that helps New Jersey creators and local businesses find each other and manage collaborations. We are not an agent, employer, or partner of any creator or business. Any agreement is between the creator and the business. We are not responsible for what they agree to or whether they follow through.",
  },
  {
    heading: "3. Who can use it.",
    body: "You must be at least 18 years old. You must give accurate information when you join.",
  },
  {
    heading: "4. Accounts and approval.",
    body: "New accounts join a waitlist and are reviewed by our team. We may approve, reject, or suspend any account at any time, for example if the information is false or the rules below are broken. You are responsible for keeping your login private and for what happens under your account.",
  },
  {
    heading: "5. Your content.",
    body: "You own the photos, text, and links you post. By posting them, you let us show them on CollabGarden NJ so the site can work. Only post things you have the right to share.",
  },
  {
    heading: "6. Collaborations and deliverables.",
    body: "A business can post offers and approve or ask for changes to a creator's work. Both sides should honor what they agreed to. Contact details stay hidden until both sides accept a match.",
  },
  {
    heading: "7. Disclose gifted and paid posts.",
    body: "Creators must clearly disclose when a post is paid for or when they received a free product or experience, for example with #ad or Instagram's paid partnership label, as the Federal Trade Commission requires. Businesses must not ask a creator to hide a partnership.",
  },
  {
    heading: "8. Payments.",
    body: 'As of now, CollabGarden NJ does not process payments or hold money. Creators and businesses arrange any payment themselves. If the site shows a payment status, it is only a record that the users entered.',
  },
  {
    heading: "9. Rules.",
    body: "Do not post false or misleading information, harass anyone, copy or scrape the site, pretend to be someone else, post anything illegal, or use the site to avoid honoring a deal you made through it.",
  },
  {
    heading: "10. No guarantees.",
    body: 'We provide the site "as is". We do not promise that you will find a match, get results, or earn money, or that the site will always work without errors.',
  },
  {
    heading: "11. Limit of responsibility.",
    body: "To the extent the law allows, we are not responsible for losses that come from deals between users, or from using or being unable to use the site.",
  },
  {
    heading: "12. Ending your account.",
    body: "You can ask us to delete your account at any time. We may end or limit access if you break these Terms.",
  },
  {
    heading: "13. Changes.",
    body: "We may update these Terms. If we make an important change, we will tell you on the site or by email. Using the site after that means you accept the new Terms.",
  },
  {
    heading: "14. Law.",
    body: "These Terms follow New Jersey law.",
  },
];

export default function TermsPage() {
  return <LegalDocument title="Terms of Use" sections={sections} />;
}
