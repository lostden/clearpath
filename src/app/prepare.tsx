import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ActionButton,
  Body,
  Disclosure,
  Heading,
  Panel,
  Screen,
  SectionTitle,
  confirmAction,
  confirmCall,
  openLink,
} from "@/ui/components";
import {
  checklistItems,
  checklistSource,
  familyPlanSource,
  importantNumbers,
  preparednessReviewedOn,
  safetyGuides,
} from "@/data/preparedness";
import { localResources, localResourcesReviewedOn } from "@/data/localResources";
import { guideFromParam } from "@/domain/preparednessNavigation";
import { usePreparation } from "@/state/PreparednessState";
import { colors, typography } from "@/ui/tokens";
const sections = [
  { id: "guides", label: "FIELD GUIDES", action: "Show field guides" },
  { id: "kit", label: "KIT", action: "Show emergency kit" },
  { id: "plan", label: "FAMILY PLAN", action: "Show family plan" },
  { id: "contacts", label: "CONTACTS", action: "Show saved contacts" },
  { id: "numbers", label: "CALL NUMBERS", action: "Show emergency numbers" },
  { id: "resources", label: "LOCAL LINKS", action: "Show local resources" },
] as const;
type PreparationSection = (typeof sections)[number]["id"];
type PreparationView = {
  requestedGuide: string | null;
  request: string | undefined;
  section: PreparationSection;
  guide: string | null;
};
export default function PrepareScreen() {
  const params = useLocalSearchParams<{ guide?: string | string[]; guideRequest?: string }>();
  const requestedGuide = guideFromParam(params.guide);
  const { saved, ready, saveStatus, storageError, canRetrySave, retrySave, update, toggle } = usePreparation();
  const requestedId = requestedGuide?.id ?? null;
  const [view, setView] = useState<PreparationView>(() => ({
    requestedGuide: requestedId, request: params.guideRequest,
    section: "guides", guide: requestedId,
  }));
  // Local section choices belong to one navigation request. A new warning
  // request displays its guide immediately without an effect or losing drafts.
  const currentRequest = view.requestedGuide === requestedId && view.request === params.guideRequest;
  const section = currentRequest ? view.section : "guides";
  const guide = currentRequest ? view.guide : requestedId;
  function setSection(section: PreparationSection) {
    setView({ requestedGuide: requestedId, request: params.guideRequest, section, guide });
  }
  function setGuide(guide: string | null) {
    setView({ requestedGuide: requestedId, request: params.guideRequest, section, guide });
  }
  const [showContact, setShowContact] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const completed = checklistItems.filter(
    (item) => saved.checked[item.id],
  ).length;
  function addContact() {
    if (
      !name.trim() ||
      !/^[+\d\s().-]{3,30}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 3
    ) {
      setContactError("Enter a name and a valid phone number.");
      return;
    }
    update({
      contacts: [
        ...saved.contacts,
        {
          id: `${Date.now()}-${saved.contacts.length}`,
          name: name.trim().slice(0, 80),
          phone: phone.trim(),
        },
      ],
    });
    setName("");
    setPhone("");
    setContactError(null);
    setShowContact(false);
  }
  return (
    <Screen>
      <Heading>PREPARE.</Heading>
      <View style={s.localStatus}>
      <View style={s.offlinePill}>
        <Text style={s.offlineText}>AVAILABLE OFFLINE</Text>
      </View>
      <Text accessibilityLiveRegion="polite" aria-live="polite" style={[s.saveStatus, saveStatus === "session" && s.unsaved]}>
        {saveStatus === "loading" ? "LOCAL COPY / LOADING" : saveStatus === "saving" ? "LOCAL COPY / SAVING" : saveStatus === "saved" ? "LOCAL COPY / SAVED ON THIS PHONE" : "SESSION ONLY / CHANGES NOT SAVED"}
      </Text>
      </View>
      {!ready && <Body>Loading saved preparation…</Body>}
      {storageError && (
        <Panel>
          <Body>{storageError}</Body>
          {canRetrySave && <ActionButton title="Retry local save" secondary onPress={retrySave} />}
        </Panel>
      )}
      <View style={s.sectionIndex}>
        {sections.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.action}
            accessibilityState={{ selected: section === item.id }}
            aria-pressed={section === item.id}
            onPress={() => {
              setFocusedField(null);
              setSection(item.id);
            }}
            style={({ pressed }) => [
              s.sectionChoice,
              section === item.id && s.sectionSelected,
              pressed && { borderColor: colors.yellow },
            ]}
          >
            <Text style={[s.sectionChoiceText, section === item.id && s.sectionSelectedText]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" aria-live="polite" style={s.sectionStatus}>
        SECTION / {sections.find((item) => item.id === section)?.label}
      </Text>
      {section === "kit" && <>
      <View style={s.sectionRow}>
        <View style={s.flex}>
        <SectionTitle>01 / EMERGENCY KIT</SectionTitle>
        </View>
        <Text style={s.progress}>
          {completed}/{checklistItems.length}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${completed} of ${checklistItems.length} emergency kit items completed`}
        accessibilityValue={{ min: 0, max: checklistItems.length, now: completed }}
        style={s.progressTrack}
      >
        <View
          style={[
            s.progressFill,
            { width: `${(completed / checklistItems.length) * 100}%` },
          ]}
        />
      </View>
      <View style={s.list}>
        {checklistItems.map((item) => (
          <Pressable
            key={item.id}
            testID={`checklist-${item.id}`}
            accessibilityRole="checkbox"
            aria-checked={!!saved.checked[item.id]}
            accessibilityLabel={item.title}
            accessibilityHint={item.detail}
            accessibilityState={{
              checked: !!saved.checked[item.id],
              disabled: !ready,
            }}
            disabled={!ready}
            onPress={() => toggle(item.id)}
            style={({ pressed }) => [s.checkRow, pressed && s.pressedRow]}
          >
            <View style={[s.box, saved.checked[item.id] && s.checked]}>
              <Text style={s.check}>{saved.checked[item.id] ? "✓" : ""}</Text>
            </View>
            <View style={s.flex}>
              <Text style={s.itemTitle}>{item.title}</Text>
              <Text style={s.detail}>{item.detail}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Disclosure title="Kit source and review">
        <Body>{checklistSource.name}</Body>
        <Body>Reviewed {preparednessReviewedOn}</Body>
        <Body>Opening the official source requires a connection.</Body>
        <ActionButton title="Open kit source" secondary onPress={() => void openLink(checklistSource.url)} />
      </Disclosure>
      </>}
      {section === "guides" && <>
      <SectionTitle>02 / FIELD GUIDANCE</SectionTitle>
      <View style={s.list}>
        {safetyGuides.map((item) => (
          <View key={item.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Read ${item.title}`}
              aria-expanded={guide === item.id}
              accessibilityState={{ expanded: guide === item.id }}
              onPress={() => setGuide(guide === item.id ? null : item.id)}
              style={({ pressed }) => [s.guideRow, pressed && s.pressedRow]}
            >
              <Text style={[s.itemTitle, s.flex]}>{item.title}</Text>
              <Text accessibilityElementsHidden style={s.expand}>{guide === item.id ? "−" : "+"}</Text>
            </Pressable>
            {guide === item.id && (
              <View style={s.guideContent}>
                <Body>{item.body}</Body>
                <Body>Reviewed {preparednessReviewedOn}</Body>
                <ActionButton
                  title={`Open ${item.sourceName} source`}
                  secondary
                  onPress={() => void openLink(item.url)}
                />
                <Body>
                  The guidance text is stored offline. Opening the source
                  requires a connection.
                </Body>
              </View>
            )}
          </View>
        ))}
      </View>
      </>}
      {section === "plan" && <>
      <SectionTitle>03 / FAMILY PLAN</SectionTitle>
      <Panel>
        <Body>
          Set a meeting place and an out-of-area contact. Edits save
          automatically. Check LOCAL COPY before closing.
        </Body>
        <Text style={s.inputLabel}>Meeting place</Text>
        <TextInput
          accessibilityLabel="Family meeting place"
          editable={ready}
          style={[s.input, focusedField === "meeting" && s.inputFocused]}
          onFocus={() => setFocusedField("meeting")}
          onBlur={() => setFocusedField(null)}
          selectionColor={colors.orange}
          placeholder="Address or familiar landmark"
          placeholderTextColor={colors.secondary}
          value={saved.meetingPlace}
          maxLength={300}
          onChangeText={(meetingPlace) => update({ meetingPlace })}
          multiline
        />
        <Text style={s.inputLabel}>Out-of-area contact</Text>
        <TextInput
          accessibilityLabel="Family out-of-area contact"
          editable={ready}
          style={[s.input, focusedField === "family-contact" && s.inputFocused]}
          onFocus={() => setFocusedField("family-contact")}
          onBlur={() => setFocusedField(null)}
          selectionColor={colors.orange}
          placeholder="Name and contact information"
          placeholderTextColor={colors.secondary}
          value={saved.outOfAreaContact}
          maxLength={300}
          onChangeText={(outOfAreaContact) => update({ outOfAreaContact })}
          multiline
        />
      </Panel>
      <Disclosure title="Family plan source and review">
        <Body>{familyPlanSource.name}</Body>
        <Body>Reviewed {preparednessReviewedOn}</Body>
        <Body>Opening the official source requires a connection.</Body>
        <ActionButton title="Open family plan source" secondary onPress={() => void openLink(familyPlanSource.url)} />
      </Disclosure>
      </>}
      {section === "contacts" && <>
      <SectionTitle>04 / SAVED CONTACTS</SectionTitle>
      {saved.contacts.map((contact) => (
        <Panel key={contact.id}>
          <Text style={s.itemTitle}>{contact.name}</Text>
          <Body>{contact.phone}</Body>
          <ActionButton
            title={`Call ${contact.name}`}
            onPress={() =>
              confirmCall(contact.phone.replace(/[^+\d]/g, ""), contact.name)
            }
            secondary
          />
          <ActionButton
            title={`Remove ${contact.name}`}
            secondary
            onPress={() =>
              confirmAction({
                title: "Remove saved contact?",
                message: contact.name,
                confirmLabel: "Remove",
                destructive: true,
                onConfirm: () =>
                    update({
                      contacts: saved.contacts.filter(
                        (item) => item.id !== contact.id,
                      ),
                    }),
              })
            }
          />
        </Panel>
      ))}
      {!saved.contacts.length && (
        <Body>
          Save key contacts. They remain on this device.
        </Body>
      )}
      {showContact ? (
        <Panel>
          <Text style={s.inputLabel}>Contact name</Text>
          <TextInput
            accessibilityLabel="Contact name"
            style={[s.input, focusedField === "contact-name" && s.inputFocused]}
            onFocus={() => setFocusedField("contact-name")}
            onBlur={() => setFocusedField(null)}
            selectionColor={colors.orange}
            placeholder="Name"
            placeholderTextColor={colors.secondary}
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          <Text style={s.inputLabel}>Phone number</Text>
          <TextInput
            accessibilityLabel="Contact phone number"
            style={[s.input, focusedField === "contact-phone" && s.inputFocused]}
            onFocus={() => setFocusedField("contact-phone")}
            onBlur={() => setFocusedField(null)}
            selectionColor={colors.orange}
            placeholder="Phone number"
            placeholderTextColor={colors.secondary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={30}
          />
          {contactError && (
            <View testID="contact-validation-error" accessibilityLiveRegion="polite" aria-live="polite">
              <Body>{contactError}</Body>
            </View>
          )}
          <ActionButton
            title="Save contact"
            onPress={addContact}
            disabled={!ready}
          />
          <ActionButton
            title="Cancel contact"
            onPress={() => setShowContact(false)}
            secondary
          />
        </Panel>
      ) : (
        <ActionButton
          title="Add emergency contact"
          secondary
          onPress={() => setShowContact(true)}
          disabled={!ready}
        />
      )}
      </>}
      {section === "numbers" && <>
      <SectionTitle>05 / EMERGENCY NUMBERS</SectionTitle>
      {importantNumbers
        .filter((item) => item.number !== "911")
        .map((item) => (
          <ActionButton
            key={`${item.label}-${item.number}`}
            title={`${item.label} · ${item.number}`}
            secondary
            onPress={() => confirmCall(item.number, item.label)}
          />
        ))}
      </>}
      {section === "resources" && <>
        <SectionTitle>06 / FRISCO & REGIONAL RESOURCES</SectionTitle>
        <Body>Links are references, not current emergency status. Opening a website requires a connection. Follow the official authority for your location.</Body>
        <Body>Links checked {localResourcesReviewedOn}</Body>
        {localResources.map((resource) => (
          <Panel key={resource.url}>
            <SectionTitle>{resource.title}</SectionTitle>
            <Body>{resource.description}</Body>
            <ActionButton title={`Open ${resource.title}`} secondary onPress={() => void openLink(resource.url)} />
          </Panel>
        ))}
      </>}
      <Disclosure title="Local storage and privacy">
      <Body>
        ClearPath has no account or analytics. Foreground GPS is optional.
        Home warning requests send your selected coordinates directly to the
        National Weather Service. Nearby river searches send them directly to
        USGS. Regional weather requests send the selected Texas or U.S.
        coverage; earthquake requests use a global feed. Optional NIFC
        wildfire requests send Texas or U.S. incident coverage. Explicit zone
        downloads send the linked public NWS zone IDs. Google Maps, or
        Apple Maps on iOS, receives the map area you view.
      </Body>
      <Body>
        Preparedness, contacts, the last selected point, and one latest Home
        NWS snapshot are saved in local app storage. The app does not encrypt
        this storage. Regional weather, earthquake, river and wildfire copies
        stay in memory and are not saved for reopening offline. Requested NWS zone
        boundaries remain in memory for up to 24 hours. The automatic/manual
        feed update preference is saved locally. There is no stored
        location history. Demo data never enters the live cache.
      </Body>
      <Body>
        Share location first opens an exact-message review. Tap Open share
        sheet, then choose where to send the selected point in the device
        share sheet. Saved GPS coordinates are labeled as last selected;
        demo coordinates are labeled as training only. Sharing does not
        recheck your position.
      </Body>
      </Disclosure>
      <Body>
        ClearPath does not monitor in the background or replace emergency
        services and official instructions.
      </Body>
    </Screen>
  );
}
const s = StyleSheet.create({
  localStatus: { gap: 8 },
  sectionIndex: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionChoice: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 56,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  sectionChoiceText: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 21, textAlign: "center" },
  sectionSelectedText: { color: colors.background },
  sectionStatus: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  saveStatus: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 14, lineHeight: 22 },
  unsaved: { color: colors.yellow },
  offlinePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.orange,
  },
  offlineText: {
    color: colors.background,
    fontFamily: typography.bodyStrong,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  progress: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24 },
  progressTrack: {
    height: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: colors.orange },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  checkRow: {
    minHeight: 72,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
  box: {
    height: 28,
    width: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  checked: { backgroundColor: colors.orange, borderColor: colors.orange },
  check: { color: colors.background, fontFamily: typography.bodyStrong, fontSize: 18, lineHeight: 24 },
  pressedRow: { backgroundColor: colors.background },
  flex: { flex: 1 },
  itemTitle: {
    color: colors.ink,
    fontFamily: typography.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
  detail: {
    color: colors.secondary,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  guideRow: {
    minHeight: 64,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
  },
  expand: { color: colors.orange, fontFamily: typography.bodyStrong, fontSize: 24, lineHeight: 30 },
  guideContent: { padding: 16, gap: 12 },
  input: {
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.background,
    padding: 14,
    minHeight: 48,
    color: colors.ink,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 24,
  },
  inputFocused: { borderColor: colors.orange },
  inputLabel: { color: colors.ink, fontFamily: typography.bodyStrong, fontSize: 16, lineHeight: 24, textTransform: "uppercase" },
});
