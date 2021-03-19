/* eslint-disable no-nested-ternary */
import { LitElement, html, css, property } from 'lit-element';

function jsonp(_url: string | URL): Promise<any> {
  const url = new URL(_url.toString())
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-bitwise
    const jsonCallbackName = `__json_callback_${((Math.random()*255*255*255)|0).toString(16).padStart(6, '0')}`
    url.searchParams.set('jsoncallback', jsonCallbackName)
    const script = document.createElement('script')
    script.setAttribute('src', url.toString())
    ;(window as any)[jsonCallbackName] = (json: any) => {
      script.remove()
      delete (window as any)[jsonCallbackName]
      resolve(json)
    }
    script.onerror = () => {
      script.remove()
      delete (window as any)[jsonCallbackName]
      reject(new Error('failed to load jsonp'))
    }
    document.head.appendChild(script)
  })
}

const apiKey = '20e8cd6d0ed013e8ef808e3799d4c7fa'

async function flickrApi(params: {method: string} & Record<string, any>) {
  const url = new URL('/services/rest', 'https://www.flickr.com')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, v)
  return jsonp(url)
}

(window as any).flickrApi = flickrApi

function preload(url: string) {
  return html`<link rel="preload" href="${url}" as="image" />`
}

function photoUrl(photo: any): string {
  let largest: string | null = null
  let largestArea = 0
  for (const k of ['sq', 'q', 't', 's', 'n', 'w', 'm', 'z', 'c', 'b', 'l']) {
    if (Object.prototype.hasOwnProperty.call(photo, `width_${k}`)) {
      const area = photo[`width_${k}`] * photo[`height_${k}`]
      if (area > largestArea) {
        largest = photo[`url_${k}`]
        largestArea = area
      }
    }
  }
  return largest!
}

function sourceUrl(photo: any): string {
  return `https://flickr.com/photos/${photo.owner}/${photo.id}`
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds - mins * 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export class FlickrGesture extends LitElement {
  @property({ type: String }) title = 'My app';

  @property({ type: String }) query: string | null = null;

  @property({ type: Boolean }) loading = false;

  @property() photos: any[] = [];

  _prevPhotos: any[] = []

  @property() remaining: number = 30

  @property() paused: boolean = false

  _interval: number = 0

  static styles = css`
    :host {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #1a2b42;
      max-width: 960px;
      margin: 0 auto;
      text-align: center;
      background-color: var(--flickr-gesture-background-color);
      line-height: 2;
    }

    input, select {
      font-size: inherit;
    }

    .lightbox {
      width: 100vw;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      box-sizing: border-box;
      padding: 1em;
      background: black;
      display: flex;
      flex-direction: column;
    }

    .lightbox .image {
      width: 100%;
      height: 100%;
      flex: 1;
      min-height: 0;
      color: white;
      position: relative;
    }

    .lightbox .image .info {
      position: absolute;
      bottom: 0;
      text-align: center;
      width: 100%;
    }

    .lightbox .image > img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      min-height: 0;
    }

    .lightbox .controls {
      color: white;
      margin-top: 1em;
    }

    a:link, a:visited {
      color: white;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `;

  time: number = 0

  onSubmit(e: Event) {
    e.preventDefault()
    const form = e.target! as HTMLFormElement
    const search = (form.elements.namedItem('search')! as HTMLInputElement).value.trim()
    this.time = Number((form.elements.namedItem('time')! as HTMLSelectElement).value)
    const perPage = Number((form.elements.namedItem('per_page')! as HTMLInputElement).value)
    if (search) {
      this.query = search;
      this.loading = true;
      flickrApi({
        method: 'flickr.photos.search',
        sort: 'relevance',
        extras: 'can_comment,can_print,count_comments,count_faves,description,isfavorite,license,media,needs_interstitial,owner_name,path_alias,realname,rotation,url_sq,url_q,url_t,url_s,url_n,url_w,url_m,url_z,url_c,url_l',
        per_page: perPage,
        text: search,
        content_type: 1,
        media: 'photos'
      }).then((res: any) => {
        this.loaded(res.photos.photo)
      })
    }
  }

  loaded(photos: any[]) {
    this.loading = false;
    this.photos = photos
    this._prevPhotos = []
    this.remaining = this.time
    this.resetTimer()
  }

  resetTimer() {
    if (this._interval) window.clearInterval(this._interval)
    this._interval = window.setInterval(() => {
      this.remaining -= 1
      if (this.remaining <= 0)
        this.next()
    }, 1000)
  }

  next() {
    if (this.photos.length === 0) return;
    this._prevPhotos.unshift(this.photos[0])
    this.photos = this.photos.slice(1)
    this.remaining = this.time
    if (this.photos.length === 0) {
      window.clearInterval(this._interval)
    } else {
      if (!this.paused)
        this.resetTimer()
    }
  }

  previous() {
    if (this._prevPhotos.length === 0) return;
    this.photos = [this._prevPhotos[0]].concat(this.photos)
    this._prevPhotos = this._prevPhotos.slice(1)
    this.remaining = this.time
    if (!this.paused)
      this.resetTimer()
  }

  pause() {
    this.paused = true
    window.clearInterval(this._interval)
  }

  play() {
    this.paused = false
    this.resetTimer()
  }

  exit() {
    window.clearInterval(this._interval)
    this.paused = false
    this.photos = []
  }

  // eslint-disable-next-line class-methods-use-this
  photo(photo: any) {
    return html`
    <div class="lightbox">
      <div class="image">
        <img alt="" src="${photoUrl(photo)}" />
        <div class="info">
          <a target="_blank" rel="noopener noreferrer" href="${sourceUrl(photo)}">${photo.ownername}</a>
        </div>
      </div>
      <div class="controls">
        ${formatDuration(this.remaining)}
        <button @click=${this.previous}>⏪</button>
        ${this.paused
          ? html`<button @click=${this.play}>▶️</button>`
          : html`<button @click=${this.pause}>⏸</button>`}
        <button @click=${this.exit}>⏹</button>
        <button @click=${this.next}>⏩</button>
      </div>
    </div>
    `
  }

  search() {
    return html`
      <form @submit=${this.onSubmit}>
        <div>
          <input type=search name=search placeholder="e.g. basketball"></input>
          <input type=submit value="Search"></input>
        </div>
        <div>
          show me
          <label><select name=per_page><option>5</option><option selected>10</option><option>25</option><option>50</option></select> photos</label>
          for
          <label>
            <select name=time>
              <option value=30>30 seconds</option>
              <option value=60>1 minute</option>
              <option value=120>2 minutes</option>
              <option value=300>5 minutes</option>
              <option value=600>10 minutes</option>
              <option value=1200>20 minutes</option>
              <option value=1800>30 minutes</option>
              <option value=2400>40 minutes</option>
              <option value=3600>60 minutes</option>
            </select>
            each
          </label>
        </div>
      </form>
    `
  }

  render() {
    return html`
      <main>
        ${this.loading
          ? 'Loading...'
          : this.photos.length
            ? html`${this.photo(this.photos[0])}${this.photos.length > 1 ? preload(photoUrl(this.photos[1])) : null}`
            : this.search()}
      </main>
    `;
  }
}
