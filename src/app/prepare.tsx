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
import { colors } from "@/ui/tokens";
export default function PrepareScreen() {
  const { saved, ready, storageError, update, toggle } = usePreparation();
  const [guide, setGuide] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
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
      <Heading>A little preparation.</Heading>
      <Body>Essentials you can open even when your connection is gone.</Body>
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
        <SectionTitle>Your emergency kit</SectionTitle>
        <Text style={s.progress}>
          {completed}/{checklistItems.length}
        </Text>
      </View>
      <View
        accessibilityLabel={`${completed} of ${checklistItems.length} emergency kit items completed`}
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
            style={s.checkRow}
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
      <SectionTitle>Know what to do</SectionTitle>
      <View style={s.list}>
        {safetyGuides.map((item) => (
          <View key={item.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Read ${item.title}`}
                aria-expanded={guide === item.id}
              accessibilityState={{ expanded: guide === item.id }}
              onPress={() => setGuide(guide === item.id ? null : item.id)}
              style={s.guideRow}
            >
              <Text style={[s.itemTitle, s.flex]}>{item.title}</Text>
              <Text style={s.itemTitle}>{guide === item.id ? "−" : "+"}</Text>
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
      <SectionTitle>Your family plan</SectionTitle>
      <Panel>
        <Body>
          Agree on a meeting place and an out-of-area person everyone can
          contact. Save the details here, and share the plan with your
          household.
        </Body>
        <Text style={s.inputLabel}>Meeting place</Text>
        <TextInput
          accessibilityLabel="Family meeting place"
          editable={ready}
          style={s.input}
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
          style={s.input}
          placeholder="Name and contact information"
          placeholderTextColor={colors.secondary}
          value={saved.outOfAreaContact}
          maxLength={300}
          onChangeText={(outOfAreaContact) => update({ outOfAreaContact })}
          multiline
        />
      </Panel>
      <SectionTitle>Your emergency contacts</SectionTitle>
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
          Keep the people you need within reach. Contacts remain on this device.
        </Body>
      )}
      {showContact ? (
        <Panel>
          <TextInput
            accessibilityLabel="Contact name"
            style={s.input}
            placeholder="Name"
            placeholderTextColor={colors.secondary}
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
          <TextInput
            accessibilityLabel="Contact phone number"
            style={s.input}
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
      <SectionTitle>Emergency numbers</SectionTitle>
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
      <SectionTitle>About your privacy</SectionTitle>
      <Body>
        ClearPath has no account or analytics. Foreground GPS is optional. Live
        alert requests send your selected coordinates directly to the National
        Weather Service. Native map providers receive the map area you view.
        Preparedness, contacts, and one latest alert snapshot are stored locally
        in app storage; this storage is not encrypted. Only the last selected
        point is saved for reopening the matching offline alert snapshot. There
        is no location history. Demo data never enters the live cache.
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
    backgroundColor: colors.blueWash,
    padding: 8,
    borderRadius: 6,
  },
  offlineText: {
    color: colors.navy,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  progress: { color: colors.secondary, fontSize: 14 },
  progressTrack: {
    height: 4,
    backgroundColor: colors.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: colors.navy },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  checkRow: {
    minHeight: 72,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  box: {
    height: 24,
    width: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  checked: { backgroundColor: colors.navy, borderColor: colors.navy },
  check: { color: colors.surface, fontSize: 17, fontWeight: "700" },
  flex: { flex: 1 },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
  },
  detail: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  guideRow: {
    minHeight: 56,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  guideContent: { padding: 16, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 14,
    minHeight: 48,
    color: colors.ink,
    fontSize: 16,
  },
  inputLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
});
