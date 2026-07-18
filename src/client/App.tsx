export function App() {
  return (
    <main className="app-shell" aria-labelledby="page-title">
      <section className="send-panel">
        <div className="panel-heading">
          <p className="eyebrow">One message, one click</p>
          <h1 id="page-title">Send Email</h1>
          <p className="lede">
            Enter a recipient, subject, and message. Keep it focused, review it once,
            and send when ready.
          </p>
        </div>

        <form className="send-form">
          <label htmlFor="recipient">Recipient</label>
          <input id="recipient" name="recipient" type="email" placeholder="name@example.com" />

          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" type="text" placeholder="A concise subject" />

          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={8} placeholder="Write your message here." />

          <button type="button">Send email</button>
        </form>
      </section>
    </main>
  );
}
