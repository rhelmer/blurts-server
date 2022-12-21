import { getMessage, getLocale } from '../../utils/fluent.js'

// FIXME use fluent

const rowHtml = (email, breachCounts) => `
<strong>${email.email} ${email.primary ? '(primary)' : ''}</strong>
<div class="rows">
${
  email.verified
    ? `<div>Appears in ${breachCounts.get(email.email)} known breaches</div>`
    : `<div>
      <img src="/images/required.png">
      <span class="verification-required">Email verification required</span>
      <br />
      <a class="settings-resend-email" data-email-id="${email.id}" href="#">Resend verification email</a>
    </div>`
}

${
  email.primary
    ? ''
    : `<button data-subscriber-id="${email.subscriber_id}" data-email-id="${email.id}" class="remove-email"><img src="/images/icon-delete.png"></button>`
}
</div>
<br>
`

function createEmailRows (emails, breachCounts) {
  // sort first by presence of `primary` key, then by email address.
  emails.sort((a, b) => a.primary ? -1 : b.primary ? 1 : 0 || a.email.localeCompare(b.email))

  return (
    emails
      .map((email) => rowHtml(email, breachCounts))
      .join('')
  )
}

export const settings = (data) => `
<div class="parent">
  <div class="child-left">
    <h2>Monitor Settings</h2>
  </div>
  <div class="child-right">
    <section>
      <h3>Breach alert preferences</h3>
      <div>
        <label class="radio-container">
          <input class="radio-comm-option" data-comm-option="0" data-form-action="update-comm-option" data-csrf-token="v4oCqLqb-UWiNksQcn48Z-S-NsZzpWox_sqU" type="radio" checked="" name="1">
          <span class="radio-label overflow-break">Send breach alerts to the affected email address</span>
          <span class="checkmark"></span>
        </label>
        <br>
        <label class="radio-container">
          <input class="radio-comm-option" data-comm-option="1" data-form-action="update-comm-option" data-csrf-token="v4oCqLqb-UWiNksQcn48Z-S-NsZzpWox_sqU" type="radio" name="1">
          <span class="radio-label overflow-break">Send all breach alerts to primary email address</span>.</span>
          <span class="checkmark"></span>
        </label>
      </div>
    </section>
    <hr>
    <section>
      <div>
        <strong>Monitored email addresses</strong>
      </div>
      <div>
        Your account includes monitoring of up to ${data.limit} emails.
      </div>
      <br>
      ${createEmailRows(data.emails, data.breachCounts)}
      <div><button id="settings-add-email" class="monitor-button">+ Add email address</button></div>
      <dialog id="add-email-modal">
        <!-- button id="settings-close"><img src="/images/close.png"></button -->
        <img src="/images/email.png">
        <h3>Add another email address</h3>
        <div id="add-email-modal-content">
          Your account includes monitoring of up to ${
            data.limit
          } emails. Add a new email address
          to see if it's been involved in a breach.
        </div>
        <br>
        <div id="add-email-modal-controls">
          <label>Email address<input id="email" type="text"></label>
          <button id="send-verification" class="monitor-button">Send verification link</button>
        </div>
      </dialog>
    </section>
    <hr>
    <section>
      <h3>Deactivate account</h3>
      <div>You can deactivate Firefox Monitor by deleting your Firefox account.</div>
      <div><a>Go to Firefox Settings</a></div>
    </section>
  </div>
</div>
`
