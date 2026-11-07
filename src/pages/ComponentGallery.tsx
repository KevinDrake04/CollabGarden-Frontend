import { useState } from "react";
import { Toast, toast } from "@heroui/react";
import {
  Handshake,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  AppAvatar,
  AppButton,
  AppInput,
  AppNotice,
  AppSearch,
  AppSelect,
  AppTextarea,
  CampaignCard,
  ConfirmDialog,
  CountyList,
  CreatorCard,
  CreatorPackageCard,
  DashboardEmptyState,
  DashboardLayout,
  DashboardSidebar,
  DashboardStatCard,
  EmptyState,
  FilterChip,
  LoadingSkeleton,
  MapPriceMarker,
  MessageBubble,
  MobileBottomNav,
  OpportunityCard,
  ProfileActions,
  ProfileDetails,
  ProfileHeader,
  ProfilePhoto,
  PublicNavbar,
  ReviewCard,
  DeliverableCard,
  DeliverableForm,
  DeliverableReview,
  DeliverableStatusBadge,
  deliverableStatuses,
  draftSubmitBlockReason,
  reviewBlockReason,
  type DeliverableSummary,
} from "../components";
import CampaignForm, {
  emptyCampaignForm,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "./campaigns/CampaignForm";

const navigationLinks = [
  { label: "Home", to: "/", icon: Home },
  { label: "Discover", to: "/discover", icon: Search },
  { label: "Dashboard", to: "/app/dashboard", icon: LayoutDashboard },
  { label: "Messages", to: "/app/messages", icon: MessageCircle },
];

const countyOptions = [
  { value: "Essex", label: "Essex" },
  { value: "Hudson", label: "Hudson" },
  { value: "Bergen", label: "Bergen" },
];

const previewCounties = [
  { county_id: 1, name: "Essex" },
  { county_id: 2, name: "Hudson" },
  { county_id: 3, name: "Bergen" },
];

const sectionClass = "mt-8 border-t border-[var(--cg-border)] pt-6";
const headingClass = "mb-4 text-xl font-semibold text-[var(--cg-text)]";
const rowClass = "mb-4 flex flex-wrap items-center gap-3";
const gridClass = "grid grid-cols-1 items-start gap-4 md:grid-cols-2";
const exampleClass = "flex flex-col gap-3";

function SampleDashboardNav({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-row flex-wrap gap-1 md:flex-col"
    >
      {items.map((item, index) => (
        <span
          key={item}
          className={
            index === 0
              ? "rounded-lg bg-[var(--cg-background)] px-3 py-2 text-sm font-medium text-[var(--cg-primary-dark)]"
              : "rounded-lg px-3 py-2 text-sm text-[var(--cg-muted)]"
          }
        >
          {item}
        </span>
      ))}
    </nav>
  );
}

const sampleCampaign = "Sample Spring Tasting";

const sampleDeliverables: DeliverableSummary[] = [
  {
    id: 101,
    title: "Sample draft story",
    campaignName: sampleCampaign,
    status: "draft",
    description: "Sample draft. This card does not come from the API.",
    creatorId: 12,
    creatorName: "Sample Creator",
    createdAt: "2026-11-01T15:00:00Z",
    attachments: [{ id: 1, type: "link", url: "https://example.com/sample-draft" }],
  },
  {
    id: 102,
    title: "Sample submitted photos",
    campaignName: sampleCampaign,
    status: "submitted",
    description: "Sample submission waiting for review.",
    creatorId: 12,
    creatorName: "Sample Creator",
    submittedAt: "2026-11-02T18:30:00Z",
    createdAt: "2026-11-02T16:00:00Z",
    attachments: [{ id: 2, type: "image", url: "/images/cafe-collab.jpg" }],
  },
  {
    id: 103,
    title: "Sample approved post",
    campaignName: sampleCampaign,
    status: "approved",
    description: "Sample deliverable that has already been approved.",
    creatorId: 12,
    creatorName: "Sample Creator",
    submittedAt: "2026-10-20T14:00:00Z",
    createdAt: "2026-10-18T14:00:00Z",
    updatedAt: "2026-10-21T14:00:00Z",
    attachments: [{ id: 3, type: "link", url: "https://example.com/sample-approved" }],
  },
  {
    id: 104,
    title: "Sample revision request",
    campaignName: sampleCampaign,
    status: "revision_requested",
    description: "Sample deliverable sent back for changes.",
    creatorId: 12,
    creatorName: "Sample Creator",
    submittedAt: "2026-10-28T12:00:00Z",
    createdAt: "2026-10-27T12:00:00Z",
    updatedAt: "2026-10-29T12:00:00Z",
    attachments: [],
  },
];

// Preview only. These components do not call the backend or persist data.
export default function ComponentGallery() {
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("");
  const [instagramSelected, setInstagramSelected] = useState(true);
  const [tiktokSelected, setTiktokSelected] = useState(false);
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [campaign, setCampaign] = useState<CampaignFormValues>(emptyCampaignForm);
  const [campaignErrors, setCampaignErrors] = useState<CampaignFormErrors>({});
  const [campaignNote, setCampaignNote] = useState("");
  const [submittedComment, setSubmittedComment] = useState("");
  const [approvedComment, setApprovedComment] = useState("");
  const [revisionComment, setRevisionComment] = useState("");

  function previewCampaign(message: string) {
    const nextErrors = validateCampaignForm(campaign);
    setCampaignErrors(nextErrors);
    setCampaignNote(Object.keys(nextErrors).length === 0 ? message : "");
  }

  return (
    <div className="w-full max-w-5xl font-sans text-[var(--cg-text)]">
      <Toast.Provider placement="top end" />

      <h1 className="text-3xl font-bold">CollabGarden Components</h1>
      <p className="mt-2 text-sm text-[var(--cg-muted)]">
        Reusable components for future pages. These are examples, not finished
        screens.
      </p>

      {/* 1. Navigation */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Navigation samples</h2>
        <div className="flex flex-col gap-6">
          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Public navigation</h3>
            <PublicNavbar
              links={navigationLinks.slice(0, 2)}
              action={{ label: "Sign up", to: "/signup" }}
            />
          </div>
          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Dashboard sidebar</h3>
            <DashboardSidebar links={navigationLinks} />
          </div>
          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Mobile navigation</h3>
            <div className="max-w-sm">
              <MobileBottomNav links={navigationLinks} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Buttons */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Buttons</h2>
        <div className={rowClass}>
          <AppButton onPress={() => toast.success("Primary button works")}>
            Primary
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={() => setNotice("Secondary button works")}
          >
            Secondary
          </AppButton>
          <AppButton variant="ghost">Ghost</AppButton>
          <AppButton variant="destructive" onPress={() => setDialogOpen(true)}>
            Destructive
          </AppButton>
        </div>
      </section>

      {/* 3. Fields and filters */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Fields and filters</h2>
        <div className={gridClass}>
          <AppInput
            label="Name"
            placeholder="Enter a name"
            helper="A standard text field"
          />
          <AppInput
            label="Email (error example)"
            placeholder="name@example.com"
            error="Please enter a valid email address."
          />
          <AppInput label="Disabled field" placeholder="Unavailable" disabled />
          <AppSearch
            label="Search creators"
            value={search}
            onChange={setSearch}
          />
          <AppSelect
            label="County"
            value={county}
            onChange={setCounty}
            options={countyOptions}
          />
          <AppTextarea
            label="Description"
            placeholder="Enter a description"
            rows={3}
          />
        </div>
        <div className={`${rowClass} mt-5`}>
          <FilterChip
            label="Instagram"
            selected={instagramSelected}
            onChange={setInstagramSelected}
          />
          <FilterChip
            label="TikTok"
            selected={tiktokSelected}
            onChange={setTiktokSelected}
          />
        </div>
      </section>

      {/* 4. Feedback and community */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Feedback and community</h2>
        <div className="flex flex-col gap-5">
          <div className={rowClass}>
            <AppAvatar name="Sample Creator" />
            <AppButton
              variant="secondary"
              onPress={() => toast.success("Toast example")}
            >
              Show toast
            </AppButton>
            <AppButton variant="secondary" onPress={() => setDialogOpen(true)}>
              Open dialog
            </AppButton>
          </div>

          {notice && (
            <AppNotice message={notice} onClose={() => setNotice("")} />
          )}

          <div className={gridClass}>
            <ReviewCard
              author="Sample Business"
              rating={5}
              review="Great communication and on-time delivery."
              date="Oct 2026"
            />
            <LoadingSkeleton />
          </div>

          <div className="flex flex-col gap-2">
            <MessageBubble text="Hi! Excited to collaborate." time="9:41 AM" />
            <MessageBubble text="Same here — thanks!" time="9:43 AM" outgoing />
          </div>

          <EmptyState
            title="No results yet"
            description="Try adjusting your filters to discover creators."
            action={
              <AppButton
                variant="secondary"
                onPress={() => setNotice("Filters cleared")}
              >
                Clear filters
              </AppButton>
            }
          />
        </div>
      </section>

      {/* 5. Creator discovery */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Creator discovery</h2>
        <div className="flex flex-col gap-5">
          <CreatorCard
            name="Sample Creator"
            county="Essex"
            category="Food & lifestyle"
            platforms={["Instagram", "TikTok"]}
            rating={4.8}
            startingPrice="$150"
            onView={() => setNotice("Creator selected")}
          />

          <div className="max-w-md">
            <CreatorPackageCard
              title="Starter Collaboration"
              description="An example creator package."
              price="$150"
              includes={["One social post", "One story", "Basic reporting"]}
              onSelect={() => setNotice("Package selected")}
            />
          </div>

          <div className={rowClass}>
            <MapPriceMarker price="$150" />
            <MapPriceMarker price="$225" active />
          </div>
        </div>
      </section>

      {/* 6. Profile components */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Profile Components</h2>
        <p className="mb-4 text-sm">
          Sample data only. These examples do not call the API.
        </p>
        <div className="flex flex-col gap-8 rounded-2xl bg-[#f8f8f0] p-4 md:p-6">
          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Business profile header</h3>
            <ProfileHeader
              eyebrow="Business"
              name="Sample Business"
              imageUrl="/images/cafe-collab.jpg"
              summary="Cafe"
              emptySummary="No category listed."
              action={
                <ProfileActions
                  actions={[{ label: "Contact business", disabled: true, badge: "Coming soon" }]}
                />
              }
            >
              <div className="mt-4">
                <div className="mb-2 text-sm text-[var(--cg-muted)]">Counties</div>
                <CountyList names={["Essex", "Hudson"]} missingLabel="No counties listed." />
              </div>
            </ProfileHeader>
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Creator profile header</h3>
            <ProfileHeader
              eyebrow="Creator"
              name="Sample Creator"
              summary="Food"
              emptySummary="No niche listed."
              action={
                <ProfileActions
                  actions={[{ label: "Collaborate", disabled: true, badge: "Coming soon" }]}
                />
              }
            >
              <div className="mt-4">
                <div className="mb-2 text-sm text-[var(--cg-muted)]">County</div>
                <CountyList names={["Essex"]} missingLabel="No county listed." />
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
                <Users size={15} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
                <span>Followers</span>
                <span className="font-medium text-[var(--cg-text)]">10K-50K</span>
              </div>
            </ProfileHeader>
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Profile details</h3>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ProfileDetails
                  title="About"
                  text="Sample description for a local cafe. This text is not from the API."
                />
              </div>
              <div className="lg:col-span-2">
                <ProfileDetails title="Collaboration types">
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {["Dining", "Gifted"].map((label) => (
                      <li
                        key={label}
                        className="rounded-full border border-[var(--cg-border)] bg-[var(--cg-background)] px-3 py-1 text-sm font-medium text-[var(--cg-primary-dark)]"
                      >
                        {label}
                      </li>
                    ))}
                  </ul>
                </ProfileDetails>
              </div>
            </div>
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Profile action buttons</h3>
            <div className="flex flex-wrap items-start gap-3">
              <ProfileActions
                actions={[{ label: "Contact business", disabled: true, badge: "Coming soon" }]}
              />
              <ProfileActions
                actions={[{ label: "Collaborate", disabled: true, badge: "Coming soon" }]}
              />
              <ProfileActions
                actions={[{
                  label: "Edit profile",
                  onPress: () => setNotice("Edit profile is only a sample action."),
                }]}
              />
            </div>
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Missing image and empty data</h3>
            <ProfilePhoto name="Sample Business" />
            <ProfileHeader
              eyebrow="Business"
              name="Sample Business"
              emptySummary="No category listed."
              action={
                <ProfileActions
                  actions={[{ label: "Contact business", disabled: true, badge: "Coming soon" }]}
                />
              }
            >
              <div className="mt-4">
                <div className="mb-2 text-sm text-[var(--cg-muted)]">Counties</div>
                <CountyList names={[]} missingLabel="No counties listed." />
              </div>
            </ProfileHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <ProfileDetails title="About" emptyLabel="No description yet." />
              <ProfileDetails title="Collaboration types" emptyLabel="No collaboration types listed." />
              <ProfileDetails title="Sample posts" emptyLabel="No sample posts yet." />
            </div>
          </div>
        </div>
      </section>

      {/* 7. Dashboard components */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Dashboard Components</h2>
        <div className="flex flex-col gap-6">
          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Business dashboard header</h3>
            <DashboardLayout
              title="Business Dashboard"
              description="Sample header for a local business. Track campaigns and creator collaborations from one place."
              navigation={
                <SampleDashboardNav
                  label="Sample business navigation"
                  items={["Campaigns", "Messages", "Payments"]}
                />
              }
            />
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Creator dashboard header</h3>
            <DashboardLayout
              title="Creator Dashboard"
              description="Sample header for a local creator. Find collaboration opportunities and active partnerships."
              navigation={
                <SampleDashboardNav
                  label="Sample creator navigation"
                  items={["Opportunities", "Collaborations", "Messages"]}
                />
              }
            />
          </div>

          <div className={exampleClass}>
            <h3 className="text-sm font-semibold">Statistic cards</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DashboardStatCard
                label="Active Campaigns"
                value={4}
                icon={<Megaphone size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Collaborations"
                value={7}
                icon={<Handshake size={20} aria-hidden="true" />}
              />
              <DashboardStatCard
                label="Opportunities"
                value={12}
                icon={<Sparkles size={20} aria-hidden="true" />}
              />
            </div>
          </div>

          <div className={gridClass}>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Active campaign</h3>
              <CampaignCard
                title="Sample Fall Menu Launch"
                description="A sample active campaign promoting a seasonal menu with a local food creator."
                status="Active"
                location="Essex County, NJ"
                budget="Budget $400"
                date="Due Nov 20"
                actionLabel="View campaign"
                onAction={() => setNotice("Sample campaign selected")}
              />
            </div>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Draft campaign</h3>
              <CampaignCard
                title="Sample Spring Tasting"
                description="A sample draft campaign that has not been published yet."
                status="Draft"
                location="Hudson County, NJ"
                budget="Budget $250"
                actionLabel="Edit draft"
                onAction={() => setNotice("Sample draft selected")}
              />
            </div>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Pending collaboration</h3>
              <CampaignCard
                title="Sample Weekend Brunch"
                description="A sample collaboration that is waiting to begin."
                status="Pending"
                location="Essex County, NJ"
                actionLabel="View collaboration"
                onAction={() =>
                  setNotice("Sample pending collaboration selected")
                }
              />
            </div>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Completed campaign</h3>
              <CampaignCard
                title="Sample Summer Patio Series"
                description="A sample campaign that has already finished."
                status="Completed"
                location="Bergen County, NJ"
                budget="Budget $300"
                actionLabel="View summary"
                onAction={() => setNotice("Sample completed campaign selected")}
              />
            </div>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">
                Creator collaboration opportunity
              </h3>
              <OpportunityCard
                businessName="Sample Cafe"
                title="Sample Weekend Brunch Feature"
                description="A sample collaboration opportunity for a local food creator to feature a weekend brunch."
                location="Essex County, NJ"
                category="Food"
                actionLabel="View opportunity"
                onAction={() => setNotice("Sample opportunity selected")}
              />
            </div>
          </div>

          <div className={gridClass}>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Empty campaigns state</h3>
              <DashboardEmptyState
                message="No campaigns yet. This sample empty state appears when a business has not created a campaign."
                actionLabel="Create campaign"
                onAction={() => setNotice("Sample create campaign selected")}
              />
            </div>
            <div className={exampleClass}>
              <h3 className="text-sm font-semibold">Empty opportunities state</h3>
              <DashboardEmptyState
                message="No opportunities yet. This sample empty state appears when there are no collaboration opportunities to show."
                actionLabel="Browse opportunities"
                onAction={() => setNotice("Sample browse opportunities selected")}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 8. Campaign form */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Campaign form</h2>
        <p className="mb-4 text-sm text-[var(--cg-muted)]">
          Basic example with sample counties. These buttons only check the form.
          They do not save or publish a campaign.
        </p>
        {campaignNote && (
          <div className="mb-4">
            <AppNotice message={campaignNote} onClose={() => setCampaignNote("")} />
          </div>
        )}
        <CampaignForm
          values={campaign}
          errors={campaignErrors}
          counties={previewCounties}
          submitting={null}
          onChange={(next) => {
            setCampaign(next);
            setCampaignErrors({});
            setCampaignNote("");
          }}
          onSaveDraft={() =>
            previewCampaign("Preview only. Save Draft does not call the API from this page.")
          }
          onPublish={() =>
            previewCampaign("Preview only. Publish does not call the API from this page.")
          }
        />
      </section>

      {/* 9. Deliverables. Sample data only. */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Deliverables</h2>
        <p className="mb-4 text-sm">
          Sample data for the deliverable components. Nothing in this section calls the API.
        </p>

        <div className={rowClass}>
          {deliverableStatuses.map((status) => (
            <DeliverableStatusBadge key={status} status={status} />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {sampleDeliverables.map((deliverable) => {
            const reason = draftSubmitBlockReason(deliverable.status);
            return (
              <DeliverableCard key={deliverable.id} deliverable={deliverable}>
                <div className="flex flex-col items-start gap-2 border-t border-[var(--cg-border)] pt-3">
                  <AppButton
                    isDisabled={Boolean(reason)}
                    aria-label={`Submit ${deliverable.title}`}
                    onPress={() => setNotice("Sample only. Submit was not sent to the API.")}
                  >
                    Submit
                  </AppButton>
                  {reason && <p className="text-sm">{reason}</p>}
                </div>
              </DeliverableCard>
            );
          })}
        </div>

        <div className="mt-6 max-w-3xl">
          <h3 className="mb-3 text-sm font-semibold">Sample deliverable form</h3>
          <DeliverableForm
            initialValues={{
              campaignId: "sample-campaign",
              title: "Sample tasting reel",
              description: "A short reel from the sample campaign.",
              attachments: [
                { key: "sample-link", type: "link", url: "https://example.com/sample-reel" },
              ],
            }}
            campaigns={[{ value: "sample-campaign", label: sampleCampaign }]}
            onSaveDraft={() => setNotice("Sample only. Save draft was not sent to the API.")}
            onSubmit={() => setNotice("Sample only. Submit was not sent to the API.")}
          />
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Sample review, submitted</h3>
          <DeliverableReview
            deliverable={sampleDeliverables[1]}
            comment={submittedComment}
            onCommentChange={setSubmittedComment}
            onApprove={() => setNotice("Sample only. Approve was not sent to the API.")}
            onRequestRevision={() => setNotice("Sample only. The revision request was not sent to the API.")}
          />

          <h3 className="text-sm font-semibold">Sample review, approved</h3>
          <DeliverableReview
            deliverable={sampleDeliverables[2]}
            comment={approvedComment}
            onCommentChange={setApprovedComment}
            onApprove={() => setNotice("Sample only. Approve was not sent to the API.")}
            onRequestRevision={() => setNotice("Sample only. The revision request was not sent to the API.")}
            blockedReason={reviewBlockReason("approved")}
          />

          <h3 className="text-sm font-semibold">Sample review, revision requested</h3>
          <DeliverableReview
            deliverable={sampleDeliverables[3]}
            comment={revisionComment}
            onCommentChange={setRevisionComment}
            onApprove={() => setNotice("Sample only. Approve was not sent to the API.")}
            onRequestRevision={() => setNotice("Sample only. The revision request was not sent to the API.")}
            blockedReason={reviewBlockReason("revision_requested")}
          />
        </div>
      </section>

      <ConfirmDialog
        open={dialogOpen}
        title="Example confirmation"
        description="This is only a component test. No data will be changed."
        onClose={() => setDialogOpen(false)}
        onConfirm={() => {
          setDialogOpen(false);
          setNotice("Confirmed");
        }}
      />
    </div>
  );
}
