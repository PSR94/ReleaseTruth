import { behaviorFor, currentVariant } from '../../lib/variant';

export default function AccountPage() {
  const behavior = behaviorFor(currentVariant());
  return (
    <section className="page-stack narrow">
      <div className="page-header"><span className="eyebrow">Account</span><h1>Profile</h1><p>Details used for receipts and delivery updates.</p></div>
      <form className="profile-card"><label>Name<input name="name" defaultValue="Demo Shopper" /></label><label>Email<input name="email" type="email" defaultValue="demo@example.com" /></label><label>City<input name="city" defaultValue="Brooklyn" /></label><button className="button primary" type="submit">{behavior.profileSaveLabel}</button></form>
    </section>
  );
}
