import logoSipevita from '../assets/branding/logo-sipevita.png';

export function Logo() {
  return (
    <div className="brand">
      <div className="brand-logo-frame">
        <img className="brand-logo-image" src={logoSipevita} alt="Logo SIPEVITA" />
      </div>
      <div>
        <strong>SIPEVITA</strong>
        <span>Verifikasi Kepemilikan Tanah</span>
      </div>
    </div>
  );
}
