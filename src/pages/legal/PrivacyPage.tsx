import { LegalDocument, type LegalSection } from "./LegalDocument";

const sections: LegalSection[] = [
  {
    heading: "What we collect.",
    body: "Your name, email, county, role (creator or business), business or niche details, social media handles and links, any photos or logos you upload, and your activity on the site such as campaigns, applications, and deliverables.",
  },
  {
    heading: "Why we collect it.",
    body: "To run your account, review applications, show your profile, match creators with businesses, and let you manage collaborations. We may also use basic usage data to improve the site.",
  },
  {
    heading: "Who sees what.",
    body: "Approved profiles are visible to visitors and other users. This includes your name or business name, county, niche, and the photo and links you choose to add. Your email and contact details are hidden from other users until both sides accept a match. Our admin team can see your account details.",
  },
  {
    heading: "Services that hold your data.",
    body: "We use outside services to run the site, including Supabase for the database, Railway for the backend, and Vercel for the website, plus any email and analytics tools we add. They process data for us and do not own it.",
  },
  {
    heading: "What we do not do.",
    body: "We do not sell your personal information.",
  },
  {
    heading: "Keeping it safe.",
    body: "We limit access to our team and use secure logins. No website is perfectly secure, so we cannot promise absolute safety.",
  },
  {
    heading: "Your choices.",
    body: "You can ask to see, correct, or delete your information by emailing collabgardennj@gmail.com. We will respond within 30 days.",
  },
  {
    heading: "Children.",
    body: "CollabGarden NJ is for people 18 and older, and we do not knowingly collect information from anyone younger.",
  },
  {
    heading: "Changes.",
    body: "If we change this policy, we will update the date above and tell you about important changes.",
  },
];

export default function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" sections={sections} />;
}
