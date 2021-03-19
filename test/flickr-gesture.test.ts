import { html, fixture, expect } from '@open-wc/testing';

import { FlickrGesture } from '../src/FlickrGesture.js';
import '../src/flickr-gesture.js';

describe('FlickrGesture', () => {
  let element: FlickrGesture;
  beforeEach(async () => {
    element = await fixture(html`<flickr-gesture></flickr-gesture>`);
  });

  it('renders a h1', () => {
    const h1 = element.shadowRoot!.querySelector('h1')!;
    expect(h1).to.exist;
    expect(h1.textContent).to.equal('My app');
  });

  it('passes the a11y audit', async () => {
    await expect(element).shadowDom.to.be.accessible();
  });
});
