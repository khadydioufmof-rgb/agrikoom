import React from 'react';

interface AgriKoomLogoProps {
  size?: number;
  showWordmark?: boolean;
}

const AGRIKOOM_LOGO_SRC = '/assets/aistudio/e31fdeca-e6f3-49d3-8db2-66281e120e4d_6c3e40c4.jpg';

export const AgriKoomLogo: React.FC<AgriKoomLogoProps> = ({ size = 36 }) => {
  return (
    <img
      src={AGRIKOOM_LOGO_SRC}
      alt="AgriKoom"
      style={{ height: size }}
      className="w-auto max-w-full object-contain select-none shrink-0"
    />
  );
};
