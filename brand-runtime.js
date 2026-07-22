(() => {
  const selector = 'img[src$="talentpluto-logo.svg"], img[src$="pluto-typeset-identifier.svg"]';
  const targets = [...document.querySelectorAll(selector)];
  if (!targets.length) return;
  fetch('assets/brand/talentpluto-logo.svg')
    .then(response => {
      if (!response.ok) throw new Error(`TalentPluto logo asset returned ${response.status}`);
      return response.text();
    })
    .then(svg => {
      const match = svg.match(/href="(data:image\/(?:jpeg|png);base64,[^"]+)"/i);
      if (!match) throw new Error('Embedded TalentPluto image was not found');
      targets.forEach(image => { image.src = match[1]; });
      document.documentElement.dataset.logoReady = 'true';
    })
    .catch(error => {
      document.documentElement.dataset.logoReady = 'false';
      console.error(error);
    });
})();
