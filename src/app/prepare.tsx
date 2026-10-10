import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ActionButton,
  Body,
  EmergencyButton,
  Heading,
  Panel,
  Screen,
  SectionTitle,
  confirmCall,
  openLink,
} from "@/ui/components";
import {
  checklistItems,
  importantNumbers,
  safetyGuides,
} from "@/data/preparedness";
import { usePreparation } from "@/state/PreparednessState";
import { colors, typography } from "@/ui/tokens";
export default function PrepareScreen() {
  const { saved, ready, storageError, update, toggle } = usePreparation();
  const [guide, setGuide] = useState<string | null>(null);
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
      <Body>Build a kit. Make a plan. Keep essentials offline.</Body>
      <View style={s.offlinePill}>
        <Text style={s.offlineText}>AVAILABLE OFFLINE</Text>
      </View>
      {!ready && <Body>Loading saved preparation…</Body>}
      {storageError && (
        <Panel>
          <Body>{storageError}</Body>
        </Panel>
      )}
      <View style={s.sectionRow}>
        <View style={s.flex}>
        <SectionTitle>01 / EMERGENCY KIT</SectionTitle>
        </View>
        <Text style={s.progress}>
          {completed}/{checklistItems.length}
        </Text>
      </View>
      <View
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
      <SectionTitle>03 / FAMILY PLAN</SectionTitle>
      <Panel>
        <Body>
          Choose a meeting place and an out-of-area contact. Save the plan.
          Share it with your household.
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
              Alert.alert("Remove saved contact?", contact.name, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () =>
                    update({
                      contacts: saved.contacts.filter(
                        (item) => item.id !== contact.id,
                      ),
                    }),
                },
              ])
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
          {contactError && <Body>{contactError}</Body>}
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
      <SectionTitle>05 / EMERGENCY NUMBERS</SectionTitle>
      <EmergencyButton />
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
      <SectionTitle>LOCAL STORAGE / PRIVACY</SectionTitle>
      <Body>
        ClearPath has no account or analytics. Foreground GPS is optional.
        Home warning requests send your selected coordinates directly to the
        National Weather Service. Nearby river searches send them directly to
        USGS. Regional weather requests send the selected Texas or U.S.
        coverage; earthquake requests use a global feed. Google Maps, or
        Apple Maps on iOS, receives the map area you view.
      </Body>
      <Body>
        Preparedness, contacts, the last selected point, and one latest Home
        NWS snapshot are saved in local app storage. The app does not encrypt
        this storage. Regional weather, earthquake, and river copies stay in
        memory and are not saved for reopening offline. There is no stored
        location history. Demo data never enters the live cache.
      </Body>
      <Body>
        Share location first opens an exact-message review. Tap Open share
        sheet, then choose where to send the selected point in the device
        share sheet. Saved GPS coordinates are labeled as last selected;
        demo coordinates are labeled as training only. Sharing does not
        recheck your position.
      </Body>
      <Body>
        ClearPath does not monitor in the background or replace emergency
        services and official instructions.
      </Body>
    </Screen>
  );
}
const s = StyleSheet.create({
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
