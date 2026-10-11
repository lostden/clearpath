# Optional location alert watcher

This is an operator-controlled, single-process Node 22+ service for a small ClearPath pilot. It polls NWS alerts for each enrolled phone's **last submitted point** and submits new verified alerts to Expo Push Service. It is prepared for review; it has not been deployed, enrolled with a real phone, or used to send a real notification.

The app's new local foreground-alert source and this optional cloud service are separate. The native cloud client is tested preparation, with no integrated enrollment controls yet. Firebase/FCM credentials in EAS, a rebuilt Android app, a reachable HTTPS host, private enrollment setup, and actual phone acceptance are still needed before cloud notifications work. No accounts, credentials, paid resources, terms, or deployments were created for this service.

## Run and test

From the repository root:

```powershell
node --test server/watcher.test.mjs
node server/index.mjs
```

Set environment variables through a private process manager before starting the second command. `server/.env.example` lists the settings; the service does **not** automatically read `.env` files. Supply a cryptographically random, unpadded base64url enrollment secret of 32–256 characters (`A–Z`, `a–z`, `0–9`, `_`, `-`), and an NWS User-Agent with the operator's real contact information. Ordinary base64 containing `+`, `/`, or `=` is rejected at startup because it cannot be used by this API's bearer parser. Never put the enrollment secret or Expo access token into `EXPO_PUBLIC_*`, source control, an APK, browser code, or a shared link.

The listener binds to `127.0.0.1:8787` by default. Local HTTP is for development only. For phone access, set `CLEARPATH_PUBLIC_URL` to the HTTPS origin of an operator-controlled TLS reverse proxy on the same host and set `CLEARPATH_TRUST_LOOPBACK_PROXY=1`. That proxy must overwrite `X-Forwarded-Proto` and connect through loopback; arbitrary forwarded headers are rejected otherwise. The service refuses public HTTP origins and public listener bindings. Firewall the backend port. CORS is not enabled.

Only one process may own the data directory. The default is `server/data/`, ignored by Git. Do not use this JSON store as a multi-instance database. Private filesystem permissions, volume encryption, backups, HTTPS termination, monitoring, availability, and ongoing costs belong to the deployment operator. Windows permissions need an appropriate private directory ACL; POSIX mode bits alone do not establish Windows access controls.

Startup validates persisted state and stops on corrupt data. Serialized state is limited to 10,000,000 UTF-8 bytes on both save and load; oversized saves are rejected before creating directories or temporary files and preserve the previous readable state. A write failure rolls back the operation, stops outbound work, and makes health fail until storage is repaired and the process restarts. Writes use a temporary file, fsync, and rename, preserving the prior file when replacement fails. The service does not overwrite corrupt state with an empty database.

## Device API

All non-health requests require authentication. Bodies are JSON, uncompressed, at most 4096 bytes, and reject extra fields. Request/remote-response timeouts are 10 seconds. URLs never carry tokens or coordinates. The server does not log request headers, coordinates, Expo tokens, provider bodies, or raw errors.

| Method and path | Authorization | Body/result |
| --- | --- | --- |
| `POST /v1/devices` | `Bearer <operator enrollment secret>` | Body `{expoPushToken, point:{latitude,longitude}, locationObservedAt}`. Returns 201 `{deviceId,bearerToken,baseline:"pending"}`. |
| `PUT /v1/devices/:deviceId/location` | `Bearer <device bearer>` | Body `{point:{latitude,longitude}, locationObservedAt}`. Returns `{updated:true}`. |
| `GET /v1/devices/:deviceId/status` | `Bearer <device bearer>` | Returns baseline/freshness/check/delivery state, without coordinates or Expo token. |
| `DELETE /v1/devices/:deviceId` | `Bearer <device bearer>` | Returns `{deleted:true}` after durable deletion; cancels in-flight work for that device. |
| `GET /health` | None | `{status:"ready"}` or 503 storage status. It is process health, not a claim that NWS/FCM/the phone is reachable. |

`locationObservedAt` is an ISO timestamp with a timezone, from the actual location fix. It must be no more than 30 minutes old and no more than one minute in the future. The app must not submit simulated or selected demo coordinates. Older fixes cannot replace a newer fix. A move discards queued old-point notices while retaining dedup history. Moving does not reset the 60-second request floor.

Store the returned per-device bearer in native secure storage. Only its SHA-256 hash is persisted server-side. Lost credentials require operator cleanup/re-enrollment; there is no public recovery or admin list endpoint. A push token can belong to only one enrollment. The enrollment secret permits new enrollments only; it cannot read or modify an existing device. Supply that secret through an explicit private operator enrollment flow, not a permanent public app setting. The service permits 10 enrollment attempts per minute and 120 authenticated device requests per minute. Pilot capacity is 100 devices. This shared-secret pilot is not a public sign-up or production identity service.

Status fields are `enabled`, `baseline` (`pending`/`ready`), `locationFresh`, `locationObservedAt`, `lastCheckAt`, `lastError`, `lastDelivery`, and `pendingReceipts`. Check failures keep the previous successful timestamp. Provider acceptance is not evidence that the phone displayed or the person read a notification.

## Alert behavior

The watcher requests only the fixed official HTTPS NWS point-alert endpoint. It does not fetch arbitrary supplied links, geographic zones, demo events, shelters, earthquakes, flood depth, evacuation routes, or NOAA forecast material. It sends public CAP records with status `Actual` and message type `Alert`/`Update`; expiry and newer `Update`/`Cancel` references suppress replaced records. CAP `sent` timestamps allow at most one minute of clock skew; a public Actual record beyond that tolerance fails the entire check before it can suppress a current warning or baseline an empty result. Test, exercise, private, expired, invalid, or unverifiable collections do not produce notifications. Provider order is retained. No student priority engine is implemented.

The first **successful** check baselines all existing current records without notifying. Thereafter, a previously unseen `(id, sent)` can generate a notification, including a warning newly encountered after movement. Seen records remain through expiry plus 48 hours. An absent provider response is not treated as no alerts. API malfunction, too many records, stale location, and storage failure pause checking instead of presenting an all-clear. Locations more than 30 minutes old stop NWS checks; the phone must submit another fix to resume. A closed or battery-restricted phone may stop sending fixes. Consequently this backend alone does not provide continuous movement tracking.

Polling has a minimum of 60 seconds per device, global concurrency 2, and at most 10 device checks per scheduler pass. Each checked device sends at most three notices per pass. Queues, histories, receipts, input, response sizes, and device count are bounded. Inactive enrollments, including stored coordinates/token/dedup data, are purged after seven days without a location update. Explicit opt-out deletes them immediately from this service's active state; operator backups and push-provider retention need separate policies.

Push payloads use channel `clearpath-nws`, title `NWS / <event>`, and generic body text directing the person to current instructions. They contain no coordinates, provider instructions, URL, or payload-selected navigation route. Data is limited to `{kind:"nws-point-alert",alertId}`; the app handles this kind by opening its fixed Home route and refreshing official data. Message timestamps remain in the server dedup ledger. Event names appear on the lock screen, so a warning type can still reveal contextual information. No test-notification endpoint exists.

TTL is bounded by warning expiry and one hour. Temporary known HTTP errors use bounded backoff and honor Retry-After. A lost response can occur after Expo accepted a message, so ambiguous sends are recorded as unknown and are not automatically resent. This favors avoiding duplicate alerts; a notice can be missed. Durable send intent prevents a restart from silently repeating an uncertain send. Cancellation or movement may occur after a push was already accepted; neither this service nor opt-out can retract that in-flight notification. The app must refresh current official instructions when opened.

Expo tickets are checked; receipts are requested after 15 minutes, retried while available, and retired before their 24-hour retention limit. `DeviceNotRegistered` stops the device until it is deleted and re-enrolled. Other credential/payload failures remain visible as failed status. Optional `EXPO_ACCESS_TOKEN` supports Expo's enhanced push security. `expo-ticket-accepted` and `provider-accepted` are separate status values; neither means delivery to the person. Push networks, phone power settings, Internet access, and hosting can delay or prevent delivery.

This service supports supplemental weather information. It does not replace official emergency alerts, public warning systems, agency directions, or emergency services. Cloud push and moving-location acceptance must be tested on a real installed phone before claiming those capabilities.

## Verification performed

`node --test server/watcher.test.mjs` exercises baseline/dedup/movement, update/cancellation/expiry filters, future CAP fail-closed behavior and the one-minute skew boundary, malformed data, private/test rejection, stale locations, auth/input/rate bounds, bearer-compatible startup secrets, TTL, opt-out during provider and push requests, durable intent, restart uncertainty, storage faults, bounded scheduling/concurrency, HTTP backoff, tickets/receipt failures and dead tokens, atomic persistence and its UTF-8 size boundary/oversized-save rollback, response bounds, timeouts, and the local HTTP contract. Network I/O is fake except loopback API tests. No real push, real enrollment, production TLS proxy, or physical-phone cloud receipt is verified.

Sources checked during implementation: [Expo sending/tickets/receipts documentation](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), and [NWS API documentation](https://www.weather.gov/documentation/services-web-api). The CAP filtering rules independently mirror `src/data/nws.ts` and `src/domain/alerts.ts`; compare both when changing provider handling.
