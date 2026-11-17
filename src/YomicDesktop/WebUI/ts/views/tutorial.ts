/* =========================================================================
 * YOMIC V2 — FIRST-RUN ONBOARDING TUTORIAL CONTROLLER
 * AUTHENTIC STORYSET BY FREEPIK (RAFIKI STYLE) VECTOR ASSETS
 * ========================================================================= */

import type { YomicApp } from '../app.js';
import { getIconSvg } from '../icons.js';

export interface TutorialSlide {
  stepNumber: number;
  badge: string;
  title: string;
  descriptionHtml: string;
  imageSrc: string;
  altText: string;
  primaryActionLabel: string;
  isFinalStep?: boolean;
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    stepNumber: 1,
    badge: '1 / 3',
    title: 'Selamat Datang di Yomic',
    descriptionHtml:
      'Platform desktop untuk mengelola dan menikmati bacaan komik digital secara efisien. Panduan singkat ini akan membantu Anda mengonfigurasi sumber bacaan dan memulai penggunaan aplikasi.',
    imageSrc: 'assets/tutorial/welcome-rafiki.svg',
    altText: 'Selamat Datang di Yomic - Storyset Rafiki',
    primaryActionLabel: 'Lanjutkan',
    isFinalStep: false
  },
  {
    stepNumber: 2,
    badge: '2 / 3',
    title: 'Integrasi Ekstensi Sumber',
    descriptionHtml:
      'Yomic menggunakan arsitektur modular berbasis ekstensi. Buka menu <strong>Ekstensi</strong> pada bilah navigasi untuk memilih repositori sumber komik yang dibutuhkan, kemudian klik <strong>Pasang</strong>.',
    imageSrc: 'assets/tutorial/extensions-rafiki.svg',
    altText: 'Integrasi Ekstensi Sumber Komik - Storyset Rafiki',
    primaryActionLabel: 'Lanjutkan',
    isFinalStep: false
  },
  {
    stepNumber: 3,
    badge: '3 / 3',
    title: 'Eksplorasi Katalog & Pustaka',
    descriptionHtml:
      'Akses katalog melalui menu <strong>Jelajahi</strong> untuk menemukan berbagai judul komik. Simpan judul pilihan ke dalam <strong>Pustaka</strong> untuk memantau pembaruan bab secara berkala.',
    imageSrc: 'assets/tutorial/browse-rafiki.svg',
    altText: 'Eksplorasi Katalog Komik dan Pustaka - Storyset Rafiki',
    primaryActionLabel: 'Jelajahi Ekstensi',
    isFinalStep: true
  }
];

export class TutorialController {
  private currentSlideIndex = 0;
  private isBound = false;

  constructor(private app: YomicApp) {}

  public init(): void {
    this.bindEvents();
  }

  public open(slideIndex = 0): void {
    const backdrop = document.getElementById('tutorialModalBackdrop');
    if (!backdrop) return;

    this.currentSlideIndex = Math.max(0, Math.min(slideIndex, TUTORIAL_SLIDES.length - 1));
    this.updateCarouselState(false);

    document.getElementById('btnOpenTutorialSidebar')?.classList.add('active');

    backdrop.style.display = 'flex';
    backdrop.classList.remove('closing');
    void backdrop.offsetWidth;
    backdrop.classList.add('open');
  }

  public close(markCompleted = false): void {
    const backdrop = document.getElementById('tutorialModalBackdrop');
    document.getElementById('btnOpenTutorialSidebar')?.classList.remove('active');
    if (!backdrop || !backdrop.classList.contains('open')) return;

    if (markCompleted) {
      this.markTutorialCompleted();
    }

    if (backdrop.classList.contains('closing')) return;
    backdrop.classList.add('closing');

    setTimeout(() => {
      backdrop.classList.remove('open', 'closing');
      backdrop.style.display = 'none';
    }, 180);
  }

  public markTutorialCompleted(): void {
    try {
      localStorage.setItem('yomic_onboarding_completed', 'true');
    } catch {
      // safe fallback
    }
  }

  public isTutorialCompleted(): boolean {
    try {
      return localStorage.getItem('yomic_onboarding_completed') === 'true';
    } catch {
      return false;
    }
  }

  public checkAutoTrigger(): void {
    // Only auto-trigger if not completed before, and library has 0 items
    if (!this.isTutorialCompleted()) {
      setTimeout(() => {
        // Double check after UI finishes bootstrap
        if (!this.isTutorialCompleted()) {
          this.open(0);
        }
      }, 450);
    }
  }

  public nextSlide(): void {
    if (this.currentSlideIndex < TUTORIAL_SLIDES.length - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    } else {
      // Final step: Close tutorial, mark complete, and navigate straight to Extensions!
      this.close(true);
      this.app.navigateToTab('extensions');
      this.showWelcomeHintToast();
    }
  }

  public prevSlide(): void {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  public goToSlide(index: number): void {
    if (index >= 0 && index < TUTORIAL_SLIDES.length && index !== this.currentSlideIndex) {
      this.currentSlideIndex = index;
      this.updateCarouselState(true);
    }
  }

  private updateCarouselState(animate = true): void {
    const track = document.getElementById('tutorialCarouselTrack');
    const dots = document.querySelectorAll<HTMLButtonElement>('.tutorial-dot');
    const btnNext = document.getElementById('btnTutorialNext') as HTMLButtonElement | null;
    const btnPrev = document.getElementById('btnTutorialPrev') as HTMLButtonElement | null;
    const slide = TUTORIAL_SLIDES[this.currentSlideIndex];

    if (track) {
      if (!animate) {
        track.style.transition = 'none';
      } else {
        track.style.transition = 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)';
      }
      const offsetPercent = this.currentSlideIndex * (100 / TUTORIAL_SLIDES.length);
      track.style.transform = `translateX(-${offsetPercent}%)`;
      if (!animate) {
        void track.offsetWidth;
        track.style.transition = 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)';
      }
    }

    // Smoothly animate dots (NO DOM destruction!)
    dots.forEach((dot, idx) => {
      if (idx === this.currentSlideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    if (btnPrev) {
      btnPrev.style.visibility = this.currentSlideIndex === 0 ? 'hidden' : 'visible';
      btnPrev.innerHTML = getIconSvg('arrow-left-s-line', { size: 18 });
    }

    if (btnNext && slide) {
      const actionLabel = slide.isFinalStep
        ? this.app.l('Jelajahi Ekstensi', 'Browse Extensions')
        : this.app.t('tutorial.next');
      btnNext.setAttribute('title', actionLabel);
      btnNext.setAttribute('aria-label', actionLabel);
      if (slide.isFinalStep) {
        btnNext.classList.remove('tutorial-icon-btn');
        btnNext.classList.add('pulse-finish');
        btnNext.innerHTML = `
          <span>${actionLabel}</span>
          ${getIconSvg('arrow-right-line', { size: 15 })}
        `;
      } else {
        btnNext.classList.add('tutorial-icon-btn');
        btnNext.classList.remove('pulse-finish');
        btnNext.innerHTML = getIconSvg('arrow-right-s-line', { size: 18 });
      }
    }
  }

  private showWelcomeHintToast(): void {
    this.app.showToast(
      this.app.l(
        'Anda berada di menu Ekstensi. Silakan pasang ekstensi sumber komik pilihan Anda untuk memulai.',
        'You are in the Extensions menu. Please install a comic source extension to get started.'
      ),
      'puzzle'
    );
  }

  private bindEvents(): void {
    if (this.isBound) return;
    this.isBound = true;

    // Dot navigation click listeners
    document.querySelectorAll<HTMLButtonElement>('.tutorial-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const idx = Number(dot.dataset.slideIndex);
        if (!isNaN(idx)) this.goToSlide(idx);
      });
    });

    // Sidebar button
    document.getElementById('btnOpenTutorialSidebar')?.addEventListener('click', () => {
      this.open(0);
    });

    // Skip button
    document.getElementById('btnTutorialSkip')?.addEventListener('click', () => {
      this.close(true);
    });

    // Next / Finish button
    document.getElementById('btnTutorialNext')?.addEventListener('click', () => {
      this.nextSlide();
    });

    // Prev button
    document.getElementById('btnTutorialPrev')?.addEventListener('click', () => {
      this.prevSlide();
    });

    // Close on backdrop click (outside modal content)
    const backdrop = document.getElementById('tutorialModalBackdrop');
    backdrop?.addEventListener('click', (ev) => {
      if (ev.target === backdrop) {
        this.close(true);
      }
    });

    // Escape key listener for tutorial
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && backdrop?.classList.contains('open')) {
        this.close(true);
      }
    });
  }
}
