import {
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  Inject,
  OnInit,
  OnDestroy, // Added for cleanup
  PLATFORM_ID,
  AfterViewInit,
  NgZone,
  ViewChild,
} from '@angular/core';
import { ContactPerson } from '../../layout/contact-person/contact-person';
import { NeedSupport } from '../../layout/need-support/need-support';
import { CommonModule, DOCUMENT } from '@angular/common'; // Added DOCUMENT
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { isPlatformBrowser } from '@angular/common'; // Added for SSR safety
import { HostListener } from '@angular/core';

type GrecaptchaV3 = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

@Component({
  selector: 'app-contact',
  imports: [
    ContactPerson,
    NeedSupport,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact implements OnInit, AfterViewInit, OnDestroy {
  private scriptElement!: HTMLScriptElement;

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (
      this.showDropdown &&
      this.dropdownContainer &&
      !this.dropdownContainer.nativeElement.contains(event.target)
    ) {
      this.showDropdown = false;
    }
  }

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private eRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document, // Injected Document token safely
  ) {}

  // ── Config ───────────────────────────────────────────────────
  readonly SITE_KEY = '6LfjDPcsAAAAAAVEKyj8xhgwgEXhfZ6G6H42papE';

  // ── UI state ─────────────────────────────────────────────────
  showDropdown = false;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  fieldErrors: Record<string, string> = {};

  categories: any[] = [];
  selectedCategory: any = null;

  formData = {
    salutation: '',
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    customerId: '',
    inquiry: '',
  };

  isLoggedIn = computed(() => !!this.authService.currentUser()?.user_id);

  // ── reCAPTCHA v3 getter ──────────────────────────────────────
  private get grecaptcha(): GrecaptchaV3 | undefined {
    if (isPlatformBrowser(this.platformId)) {
      return (window as any).grecaptcha as GrecaptchaV3 | undefined;
    }
    return undefined;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    // 1. Dynamic Script Loader (Only runs in browser environments)
    if (isPlatformBrowser(this.platformId)) {
      this.loadReCaptchaScript();
    }

    this.fetchCategories();

    if (this.isLoggedIn()) {
      this.authService.fetchCustomer();
    }

    this.authService.getCustomerData().subscribe((data) => {
      if (!data) return;

      console.log(data);
      this.formData.salutation = data.salutation || '';
      this.formData.title = data.title || '';
      this.formData.firstName = data.firstName || '';
      this.formData.lastName = data.lastName || '';
      this.formData.email = data.email || '';
      this.formData.customerId = data.id || '';
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    // Left empty deliberately as v3 functions on demand
  }

  ngOnDestroy(): void {
    // 2. Cleanup to keep other pages light & remove the Google floating badge
    if (isPlatformBrowser(this.platformId)) {
      if (this.scriptElement) {
        this.scriptElement.remove();
      }
      const badge = this.document.querySelector('.grecaptcha-badge');
      if (badge) {
        badge.remove();
      }
    }
  }

  // ── reCAPTCHA Script Controller ──────────────────────────────

  private loadReCaptchaScript(): void {
    // Avoid double injection if user flips back and forth rapidly
    if (this.document.getElementById('recaptcha-v3-script')) {
      return;
    }

    this.scriptElement = this.document.createElement('script');
    this.scriptElement.id = 'recaptcha-v3-script';
    this.scriptElement.src = `https://www.google.com/recaptcha/api.js?render=${this.SITE_KEY}`;
    this.scriptElement.async = true;
    this.scriptElement.defer = true;

    this.document.body.appendChild(this.scriptElement);
  }

  // ── Dropdown ─────────────────────────────────────────────────
  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }

  selectCategory(item: any, event: Event): void {
    event.stopPropagation();
    this.selectedCategory = item;
    this.showDropdown = false;
  }

  // ── reCAPTCHA v3 Execution ───────────────────────────────────
  private getRecaptchaToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const g = this.grecaptcha;

      if (!g) {
        reject('reCAPTCHA not loaded. Please refresh the page.');
        return;
      }

      g.ready(() => {
        g.execute(this.SITE_KEY, { action: 'contact_form' })
          .then(resolve)
          .catch(() => reject('reCAPTCHA error. Please refresh the page.'));
      });
    });
  }

  // ── Validation ───────────────────────────────────────────────
  validate(): boolean {
    this.fieldErrors = {};

    if (!this.formData.salutation.trim()) {
      this.fieldErrors['salutation'] = 'Bitte Anrede eingeben';
    }
    if (!this.formData.firstName.trim()) {
      this.fieldErrors['firstName'] = 'Bitte Vorname eingeben';
    }
    if (!this.formData.lastName.trim()) {
      this.fieldErrors['lastName'] = 'Bitte Nachname eingeben';
    }
    if (!this.formData.email.trim()) {
      this.fieldErrors['email'] = 'Bitte E-Mail eingeben';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      this.fieldErrors['email'] = 'Ungültige E-Mail-Adresse';
    }
    if (!this.selectedCategory) {
      this.fieldErrors['category'] = 'Bitte Betreff auswählen';
    }
    if (!this.formData.inquiry.trim()) {
      this.fieldErrors['inquiry'] = 'Bitte Nachricht eingeben';
    }

    return Object.keys(this.fieldErrors).length === 0;
  }

  // ── API calls ────────────────────────────────────────────────
  fetchCategories(): void {
    this.http.post<any>('http://192.168.0.155:8080/fetch-contact-category', {}).subscribe({
      next: (res) => {
        this.categories = res || [];
      },
      error: (err) => {
        console.error('Error fetching categories:', err);
      },
    });
  }

  async submitForm(): Promise<void> {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.validate()) return;

    this.isSubmitting = true;

    let recaptchaToken: string;

    try {
      recaptchaToken = await this.getRecaptchaToken();
    } catch (err) {
      this.ngZone.run(() => {
        this.errorMessage =
          typeof err === 'string' ? err : 'reCAPTCHA-Fehler. Bitte Seite neu laden.';
        this.isSubmitting = false;
      });
      return;
    }

    this.http
      .post('http://192.168.0.155:8080/save-customer-contact', {
        ...this.formData,
        adminId: 1,
        categoryId: this.selectedCategory.id,
        recaptchaToken,
      })
      .subscribe({
        next: () => {
          this.successMessage = 'Ihre Anfrage wurde erfolgreich übermittelt.';
          this.isSubmitting = false;
        },
        error: () => {
          this.errorMessage = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
          this.isSubmitting = false;
        },
      });
  }
}
