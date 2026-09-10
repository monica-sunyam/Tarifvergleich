import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { ContactPerson } from '../../layout/contact-person/contact-person';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import SignaturePad from 'signature_pad';
import {
  CountdownConfig,
  CountdownEvent,
  CountdownComponent,
  CountdownModule,
} from 'ngx-countdown';
import { environment } from '../../environments/environment';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Inject, PLATFORM_ID } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { NeedSupport } from '../../layout/need-support/need-support';
import { AddressService } from '../../services/address.service';
import { MatSelectModule } from '@angular/material/select';
import { NgSelectModule } from '@ng-select/ng-select';

const API_BASE = 'http://192.168.0.155:8080';
interface Card {
  logo: string;
  title: string;
  deliveryId: number;
  date: string;
  data: {
    label: string;
    value: string;
    icon: string;
  }[];
}

@Component({
  selector: 'app-customer',
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
    CountdownModule,
    QRCodeComponent,
    ContactPerson,
    NeedSupport,
    MatSelectModule,
    NgSelectModule,
  ],
  templateUrl: './customer.html',
  styleUrl: './customer.css',
})
export class Customer {
  isBrowser = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly authService: AuthService,
    private readonly eRef: ElementRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly addressService: AddressService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  tabs: string[] = [
    'Persönliche Daten / Verträge',
    'Zähler & Verträge',
    'Wechselinnerung',
    'Serviceanfragen',
    'Beratervollmacht',
    'Dokumentenarchiv',
    'Passwort zurücksetzen',
  ];

  /* ── Tab control ──────────────────────────────────────────────── */
  activeTab: number = 0;
  serviceTab: number = 1;
  documentTab: number = 0;

  // ── Profile sub-tab control ─────────────────────────────────────────
  profileSubTab: string = ''; // 'contact' | 'addresses' | 'meters' | 'payment' | 'contracts'

  /* ── Step control ──────────────────────────────────────────────── */
  currentStep: number = 1;
  redirect: number = 3;
  /* ── Customer Type (PRIVATE/Business) ──────────────────────────────────────────────── */
  customerType: string = 'PRIVATE';
  isNotificationEnabled: boolean = true;

  fieldErrors: Record<string, string> = {};
  meterReadingCategories: any[] = [];
  invoiceCategories: any[] = [];

  customerData: any = {
    id: null,
    name: '',
    email: '',
    phone: '',
    phoneNumber: '', // ← add (template uses customerData.phoneNumber)
    dateOfBirth: '', // ← add
    emailVerified: false, // ← add (used by status card)
    salutation: '',
    title: '',
    firstName: '',
    lastName: '',
    userType: '',
    companyName: '',
    isVerified: false,
    joinedOn: null,
    address: {
      zip: '',
      city: '',
      street: '',
      houseNumber: '',
    },
    additionalAddresses: [], // ← add (further addresses table)
    standardMeters: [], // ← add (standard meter form rows)
    additionalMeters: [], // ← add (further meters table)
    standardBankAccounts: [], // ← add (SEPA cards)
    additionalBankAccounts: [], // ← add (further payment table)
    subAccounts: [], // ← sub-account contact profiles
    deliveryDetails: [],
  };

  isLoading = true;
  isLoadingNewReq: boolean = false;
  isLoadingCallback: boolean = false;
  isLoadingNewMsg: boolean = false;
  isLoadingReopen: boolean = false;

  isDesktop: boolean = true;

  setActiveTab(index: number) {
    if (this.qrScanned && index !== 4) {
      return;
    }

    this.viewSection = 0;
    this.activeTab = index;
    this.currentStep = 1;
    this.serviceTab = 1;
    this.documentTab = 0;
    this.selectedIndex = -1;
    this.profileSubTab = '';
    this.resetForm();
    this.resetContractChangeForm();

    if (this.activeTab == 2 || this.activeTab == 1) {
      this.fetchCards();
    }

    if (this.activeTab == 3) {
      this.fetchServiceCount();
      this.fetchAllRequests();
      this.showDetails = false;
      this.confirmationList = false;
      console.log('active changes', this.showDetails);
      this.cdr.detectChanges();
    }
    if (this.activeTab == 4) {
      this.checkAttorneyStatus();
    }
    this.redirectToMeter = false;
    this.submittedDiscountRequest = false;
    this.submittedEnergyMessage = false;
    this.submittedCallback = false;
    this.submittedInvoice = false;
    this.contractChangeSuccess = false;
    this.submittedReportMeterReading = false;
    this.supplierMessageCategory = 0;
    this.cdr.detectChanges();
  }

  nextStep(step: number) {
    this.currentStep = step;
    if (step === 2 && this.activeTab === 4) {
      setTimeout(() => {
        this.initSignature();
      });
    }

    this.isResendDisabled = true;
    if (step === 2 && this.activeTab === 6) {
      setTimeout(() => {
        this.isResendDisabled = true;
        this.resendSuccess = false;

        if (this.countdown) {
          this.countdown.restart();
        }
      }, 0);
    }
  }
  nextRoute(step: number) {
    this.redirect = step;
    this.cdr.detectChanges();
  }
  selectedMeter: any = null;

  reportMeterReading(step: number, item?: any) {
    this.redirect = step;
    this.nextStep(2);
    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }

  rerquestInvoice(item?: any) {
    this.nextStep(4);
    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }

  rerquestCallback(item?: any) {
    this.nextStep(5);
    this.loadAvailableDays();
    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }

  cancellationService(item?: any) {
    this.nextStep(9);
    this.loadAvailableDays();
    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }

  messageEnergySupplier(item?: any) {
    this.nextStep(6);

    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }

  // changeContractDetails(item?: any) {
  //   this.nextStep(7);
  //   if (item) {
  //     this.selectedMeter = item;
  //   }
  //   this.cdr.detectChanges();
  // }

  changeContractDetails(item?: any) {
    this.nextStep(7);
    if (item) {
      this.selectedMeter = item;

      this.contractChangeData = {
        deliveryId: item?.deliveryId ?? item?.id ?? null,
        lastName: item?.personLastName || '',
        companyName: item?.personCompanyName || '',
        title: item?.personTitle || '',
        firstName: item?.personFirstName || '',
        salutation: item?.personSalutation || '',
        dateOfBirth: item?.personDob || '',
        billingPLZ: item?.billingAddressData?.zip || '',
        billingOrt: item?.billingAddressData?.city || '',
        billingStreet: item?.billingAddressData?.street || '',
        billingHouseNumber: item?.billingAddressData?.houseNumber || '',
        deliveryHouseNumber: item?.deliveryAddressData?.houseNumber || '',
        email: item?.emailData?.email || '',
        iban: item?.bankData?.iban || '',
        accountHolder:
          `${item?.bankData?.firstName || ''} ${item?.bankData?.lastName || ''}`.trim(),
        otherRequest: '',
        phoneNumber: item?.personNumber || '',
      };

      this.selectedContractOptions = [];
      this.submittedSelections = [];
      this.fieldErrors = {};
      this.addressFieldErrors = {};
      this.uploadedContractDocuments = {};
    }
    this.cdr.detectChanges();
  }

  changeDiscount(item?: any) {
    this.nextStep(8);
    if (item) {
      this.selectedMeter = item;
    }
    this.cdr.detectChanges();
  }
  showLogoutModal: boolean = false;

  openLogoutModal() {
    this.showLogoutModal = true;
  }

  closeLogoutModal() {
    this.showLogoutModal = false;
  }

  logout() {
    this.showLogoutModal = false;

    // console.log('Logged out');

    this.authService.logout();
  }

  qrScanned: boolean = false;
  ngOnInit(): void {
    const user = localStorage.getItem('auth_user');
    document.addEventListener('click', this.contractDocClickHandler, true);
    if (!user) {
      this.router.navigate(['/home']);
      return;
    }

    const data = this.route.snapshot.queryParamMap.get('data');

    if (data) {
      this.handleQRLogin(data);
    }

    this.fetchSupplierMessageCategories();
    this.loadAvailableDays();
    this.checkDevice();
    this.fetchAllRequests();
    this.fetchServiceCount();
    this.fetchCustomer();
    this.fetchDeliveryByAddress();
    this.fetchCards();
    this.fetchCategories('general');
    this.fetchMeterReadingCategories();
    this.fetchInvoiceCategories();
    this.checkAttorneyStatus();
    this.fetchContractEditOptions();
    this.fetchCancellationCategories();
  }

  handleQRLogin(data: string) {
    try {
      const decoded = JSON.parse(atob(data));

      if (decoded.flag !== 'CUSTOMER_ONLY') {
        console.error('Access denied');
        return;
      }

      localStorage.setItem('auth_user', JSON.stringify(decoded));

      // optional flag for limited access
      localStorage.setItem('qr_mode', 'true');
      this.qrScanned = true;
      this.activeTab = 4;
      this.nextStep(2);
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Decode error', e);
    }
  }

  checkDevice(): void {
    this.isDesktop = window.innerWidth >= 1024;
  }

  fetchMeterReadingCategories() {
    const payload = { adminId: 1 };
    this.http
      .post<any>(`${API_BASE}/customer/fetch-report-meter-reading-category`, payload)
      .subscribe({
        next: (res) => {
          if (res?.res) {
            this.meterReadingCategories = res.data.map((item: any) => {
              return {
                label: item.categoryName,
                value: item.reportMeterReadingCategoryId,
              };
            });
          }
        },
        error: (err) => console.error(err),
      });
  }

  fetchInvoiceCategories() {
    const payload = { adminId: this.customerData?.adminId || 1 };
    this.http.post<any>(`${API_BASE}/customer/fetch-invoice-categories`, payload).subscribe({
      next: (res) => {
        if (res?.res) {
          this.invoiceCategories = res.data.map((item: any) => {
            return {
              label: item.categoryName,
              value: item.invoiceCategoryId,
            };
          });
        }
      },
      error: (err) => console.error(err),
    });
  }

  /*── Fetch customer details ──*/

  private fetchCustomer(): void {
    const customerId = this.authService.getUserId() || 0;

    const body = {
      id: Number(customerId),
    };

    this.http.post<any>(`${API_BASE}/customer/fetch-customer-detail`, body).subscribe({
      next: (res) => {
        if (!res?.res || !res?.data) {
          console.error('Invalid response');
          // this.isLoading = false;
          return;
        }

        const data = res.data;

        this.customerData = {
          id: data.id,
          name: `${data?.firstName || ''} ${data?.lastName || ''}`.trim(),
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          phone: data.mobileNumber || '',
          phoneNumber: data.mobileNumber || '', // ← add
          telephone: data.telephone || '',
          dateOfBirth: data.dateOfBirth || '', // ← add (adjust field name to match your API)
          emailVerified: data.isVerified || false, // ← add (map from whatever API field)
          salutation: data.salutation || '',
          title: data.title || '',
          userType: data.userType || '',
          companyName: data.companyName || '',
          isVerified: data.isVerified || false,
          joinedOn: data.joinedOn || null,
          isNotificationEnabled: data.isNotificationEnabled ?? true,

          address: {
            zip: data?.address?.zip || '',
            city: data?.address?.city || '',
            street: data?.address?.street || '',
            houseNumber: data?.address?.houseNumber || '',
          },

          additionalAddresses: data.additionalAddresses || [], // ← add
          standardMeters: data.standardMeters || [], // ← add
          additionalMeters: data.additionalMeters || [], // ← add
          standardBankAccounts: data.standardBankAccounts || [], // ← add
          additionalBankAccounts: data.additionalBankAccounts || [], // ← add
          subAccounts: data.subAccounts || [], // ← sub-account contact profiles

          deliveryDetails: data.deliveryDetails || [],
          attornyPdfUrl: data.attornyPdfUrl || '',
        };

        this.isNotificationEnabled = this.customerData.isNotificationEnabled;
        this.customerType = this.customerData.userType;
        // console.log('customerData:', this.customerData);

        if (this.isNotificationEnabled) {
          this.selection = 'yes';
        } else {
          this.selection = 'no';
        }

        // PREFILL ADDRESS DROPDOWNS
        if (this.customerData?.address?.zip) {
          this.addressService
            .getCitiesByZip(this.customerData.address.zip)
            .subscribe((cities: any[]) => {
              this.editCityOptions = cities;
              this.editFilteredCityOptions = cities;

              // PREFILL CITY INPUT
              this.editCitySearch = this.customerData.address.city;

              // LOAD STREETS IF CITY EXISTS
              if (this.customerData.address.city) {
                this.addressService
                  .getStreetsByCity(this.customerData.address.zip, this.customerData.address.city)
                  .subscribe((streets: any[]) => {
                    this.editStreetOptions = streets;
                    this.editFilteredStreetOptions = streets;

                    // PREFILL STREET INPUT
                    this.editStreetSearch = this.customerData.address.street;

                    this.cdr.detectChanges();
                  });
              }

              this.cdr.detectChanges();
            });
        }

        this.contractChangeData = {
          lastName: data.lastName || '',
          companyName: data.companyName || '',
          title: data.title || '',
          firstName: data.firstName || '',
          salutation: data.salutation || '',
          dateOfBirth: data.dateOfBirth || '',
        };

        this.cdr.detectChanges();
        // this.isLoading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        // this.isLoading = false;
      },
    });
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /*── Meter Section Start ──*/
  meterList: any[] = [];

  inactiveMeterList = [
    {
      status: 'Gekündigt zum 18.03.2025',

      meterIcon: 'assets/icons/electric-meter.png',

      brandImage: 'assets/icons/Icons_energyprovider/ExtraGruen.png',

      providerIcon: 'assets/icons/1c55b9e7-760a-4cb5-b070-69f9316ac0f7_Warmepumpe.png',

      providerType: 'Heizstrom | Wärmepumpe',

      tariff: 'Energie Öko-Extra 24',

      meterNumber: 'WP-36546465444',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermannstraße 29',
        city: '12345 Musterhausen',
      },

      contractNumber: '0215/3216546546541',
      contractStart: '12.03.2023',
      cancelledDate: '18.03.2025',
    },

    {
      status: 'Gekündigt zum 28.03.2026',

      meterIcon: 'assets/icons/electric-meter.png',

      brandImage: 'assets/icons/Icons_energyprovider/goldgas.png',

      providerIcon: 'assets/icons/9a900962-9eab-4317-9dc7-b1d1e529dbe4_Ladestrom.png',

      providerType: 'Ladestrom | Autostrom',

      tariff: 'CAR-SUN-085788787346',

      meterNumber: '3CAR25914564-145452',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermannstraße 29',
        city: '12345 Musterhausen',
      },

      contractNumber: '0CAR12-7849146',
      contractStart: '28.03.2025',
      cancelledDate: '28.03.2026',
    },
  ];

  electricityList: any[] = [];

  inactiveMeterList2 = [
    {
      status: 'Gekündigt zum 10.03.2026',

      tariff: 'EG ÖkoGrünStrom Extra 18',
      brandImage: 'assets/icons/Icons_energyprovider/ExtraGruen.png',

      providerIcon: 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png',

      providerType: 'Strom | Hausstrom',

      meterNumber: 'WP-36546465444',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermannstraße 29',
        city: '12345 Musterhausen',
      },

      contractNumber: '0815/245786554469',

      minimumTerm: '12 Monate',

      contractStart: '22.04.2025',

      autoRenewal: '22.04.2026',

      workPrice: '26,80 Ct./kWh',

      basePrice: '14,90 €/Monat',

      monthlyPrice: '68,40 €',

      cancelledDate: '18.03.2025',
    },

    {
      status: 'Gekündigt zum 21.01.2026',

      tariff: 'GoldGas24 Öko',
      brandImage: 'assets/icons/Icons_energyprovider/goldgas.png',

      providerIcon: 'assets/icons/1a9ebeaf-78b8-48a3-9514-94f57aa1de2c_Gasvergleich.png',

      providerType: 'Gas',

      meterNumber: '3CAR25914564-145452',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermannstraße 29',
        city: '12345 Musterhausen',
      },

      contractNumber: '012455-64564564k1245',

      minimumTerm: '12 Monate',

      contractStart: '01.02.2025',

      autoRenewal: '01.02.2026',

      workPrice: '11,72 Ct./kWh',

      basePrice: '21,90 €/Monat',

      monthlyPrice: '151,40 €',

      cancelledDate: '28.03.2026',
    },
  ];

  electricity = [
    {
      type: 'electricity',

      meterIcon: 'assets/icons/Icons_energyprovider/eon.png',

      providerIcon: 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png',

      providerType: 'Strom | Hausstrom',

      tariff: 'E.ON ÖkoStrom Extra 12',

      contractNumber: '0215/123456789',
      customerNumber: '2026-1234567890',

      meterNumber: 'MHD-OZR-1325-79-45943268',
      marketLocation: 'MILD-054321-98674',

      meterName: 'MHD-OZR-1325-79-45943268',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermannstraße 29',
        city: '12345 Musterhausen',
      },
    },

    {
      type: 'electricity',

      meterIcon: 'assets/icons/Icons_energyprovider/ExtraGruen.png',

      providerIcon: 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png',

      providerType: 'Strom | Hausstrom',

      tariff: 'EG ÖkoGrünStrom Extra 18',

      contractNumber: '012455-64564564',
      customerNumber: '546321456987',

      meterNumber: 'ZKH-31259147-122',
      marketLocation: 'MILD-054321-9874563',

      meterName: 'Mustermänstraße 29',

      address: {
        name: 'Marie Mustermann',
        street: 'Mustermänstraße 29',
        city: '12345 Musterhausen',
      },
    },
  ];
  // =============================
  // SELECTED METER EDIT
  // =============================
  isEditingSelectedMeterName = false;
  originalSelectedMeterName = '';

  editSelectedMeterName() {
    this.originalSelectedMeterName = this.selectedMeter?.meterDesignation || '';

    this.isEditingSelectedMeterName = true;
  }

  saveSelectedMeterName() {
    const meterDesignation = (this.selectedMeter?.meterDesignation || '').trim();

    // Check empty value
    if (!meterDesignation) {
      this.scheduleErrorMessage = 'Zählerbezeichnung darf nicht leer sein.';
      return;
    }

    this.isEditingSelectedMeterName = false;
    const payload = {
      connectionId: this.selectedMeter?.id,
      meterDesignation: this.selectedMeter?.meterDesignation,
    };

    this.http.post<any>(`${API_BASE}/customer/update-meter-designation`, payload).subscribe({
      next: (res) => {
        if (res?.res) {
          this.isEditingSelectedMeterName = false;

          // console.log(res.message);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  cancelSelectedMeterEdit() {
    // this.selectedMeter.meterName = this.originalSelectedMeterName;

    // this.isEditingSelectedMeterName = false;

    this.selectedMeter.meterDesignation = this.originalSelectedMeterName;

    this.selectedMeter.isEditingSelectedMeterName = false;

    // Remove temporary original value
    // delete this.selectedMeter.originalMeterName;

    this.cdr.detectChanges();
  }

  // =============================
  // LIST ITEM METER EDIT
  // =============================

  editListMeterName(item: any) {
    item.originalMeterName = item.meterDesignation;
    item.isEditingMeterName = true;
  }

  private syncMeterDesignation(deliveryId: number, newName: string) {
    const updateList = (list: any[]) => {
      list.forEach((item) => {
        if (item.deliveryId === deliveryId) {
          item.meterDesignation = newName;
        }
      });
    };

    updateList(this.meterList);
    updateList(this.electricityList);
    this.cdr.detectChanges();
  }

  saveListMeterName(item: any) {
    const meterDesignation = (item.meterDesignation || '').trim();

    // Check empty value
    if (!meterDesignation) {
      this.scheduleErrorMessage = 'Zählerbezeichnung darf nicht leer sein.';
      return;
    }
    const payload = {
      connectionId: item.id,
      meterDesignation: item.meterDesignation,
    };

    this.http.post<any>(`${API_BASE}/customer/update-meter-designation`, payload).subscribe({
      next: (res) => {
        if (res?.res) {
          item.isEditingMeterName = false;

          this.syncMeterDesignation(item.deliveryId, item.meterDesignation);
          delete item.originalMeterDesignation;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error(err),
    });
  }
  $itemAny(item: any): any {
    return item;
  }

  cancelListMeterEdit(item: any) {
    // item.meterName = item.originalMeterName;
    // item.isEditingMeterName = false;

    item.meterDesignation = item.originalMeterName;

    item.isEditingMeterName = false;

    // Remove temporary original value
    delete item.originalMeterName;

    this.cdr.detectChanges();
  }

  // Report meter reading
  meterReadingCategory: number | null = null;
  meterReadingDate: string = '';
  meterReadingValue: string = '';
  submittedReportMeterReading: boolean = false;

  validateMeterReadingForm(): boolean {
    this.fieldErrors = {};
    let isValid = true;

    // Category
    if (!this.meterReadingCategory) {
      this.fieldErrors['meterReadingCategory'] = 'Bitte Kategorie wählen';
      isValid = false;
    }

    // Date
    if (!this.meterReadingDate?.trim()) {
      this.fieldErrors['meterReadingDate'] = 'Bitte Ablesedatum eingeben';
      isValid = false;
    }

    // Meter value
    const meterValue = this.meterReadingValue?.toString().trim();

    if (!meterValue) {
      this.fieldErrors['meterReadingValue'] = 'Bitte Zählerstand eingeben';
      isValid = false;
    } else if (!/^\d+$/.test(meterValue)) {
      this.fieldErrors['meterReadingValue'] = 'Nur ganze Zahlen erlaubt';
      isValid = false;
    } else if (Number(meterValue) <= 0) {
      this.fieldErrors['meterReadingValue'] = 'Der Zählerstand muss größer als 0 sein';
      isValid = false;
    }

    return isValid;
  }

  redirectPhotoUpload() {
    if (!this.validateMeterReadingForm()) {
      // console.log('validation failed', this.fieldErrors);
      return;
    }

    // console.log('redirect working');

    this.redirect = 4;
  }

  selectedFiles: File[] = [];
  replaceIndex: number | null = null;
  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.selectedFiles.push(file);

    // ✅ MOVE TO STEP 3 AFTER FIRST FILE SELECT
    if (this.currentStep !== 3) {
      this.currentStep = 3;
    }
    this.cdr.detectChanges();
  }
  getPreview(file: File): string {
    return URL.createObjectURL(file);
  }
  removeImage(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  @ViewChild('fileInput')
  fileInput!: ElementRef<HTMLInputElement>;

  // NORMAL IMAGE ADD
  onReplaceFileSelected(event: any) {
    const file = event.target.files?.[0];

    if (!file) return;

    // REPLACE IMAGE
    if (this.replaceIndex !== null) {
      this.selectedFiles[this.replaceIndex] = file;

      this.replaceIndex = null;
    } else {
      // NORMAL ADD
      this.selectedFiles.push(file);
    }

    // RESET INPUT
    event.target.value = '';

    // MOVE TO STEP 3
    if (this.currentStep !== 3) {
      this.currentStep = 3;
    }

    this.cdr.detectChanges();
  }

  // CLICK DELETE + OPEN PICKER
  replaceImage(index: number, input: HTMLInputElement) {
    this.replaceIndex = index;

    input.click();
  }
  getMeterReadingStatus(item: any): string {
    const status = item?.reportMeterReadings?.[0]?.status;

    if (status === 1) {
      return 'Im Gange';
    }

    if (status === 2) {
      return 'Weitergeleitet';
    }

    return '';
  }
  submitMeterReading() {
    const payload = {
      deliveryId: this.selectedMeter?.deliveryId,
      orderId: this.selectedMeter?.order.orderId,
      connectionId: this.selectedMeter?.id,
      customerId: Number(this.authService.getUserId()),
      category: this.meterReadingCategory,
      readingDate: this.meterReadingDate,
      meterReading: this.meterReadingValue,
      adminId: 1,
    };

    const formData = new FormData();

    // DTO JSON
    formData.append('data', JSON.stringify(payload));

    // MULTIPLE FILES
    this.selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    this.http.post(`${API_BASE}/customer/report-meter-reading`, formData).subscribe({
      next: (res: any) => {
        // console.log('Meter reading success', res);

        if (res) {
          this.submittedReportMeterReading = true;
        }

        this.cdr.detectChanges();
      },

      error: (err) => {
        console.error('Meter reading error', err);
      },
    });
  }

  /*--- Request Invoice ---*/
  invoiceCategory: number | null = null;
  invoiceMessage: string = '';
  submittedInvoice: boolean = false;

  hasInvoice(item: any): boolean {
    // console.log('check item ', item);
    return Array.isArray(item?.invoiceRequests) && item.invoiceRequests.length > 0;
  }

  getInvoiceStatus(item: any): string {
    const status = item?.invoiceRequests?.[0]?.status || '';

    if (status === 1) {
      return 'Im Gange';
    }

    if (status === 2) {
      return 'Weitergeleitet';
    }

    return '';
  }

  submitInvoiceRequest() {
    const payload = {
      customerId: Number(this.authService.getUserId()),
      connectionId: this.selectedMeter?.id,
      deliveryId: this.selectedMeter?.deliveryId ?? 0,
      invoiceCategory: this.invoiceCategory,
      orderId: this.selectedMeter?.order.orderId,
      message: this.invoiceMessage,
      adminId: 1,
    };

    this.http.post<any>(`${API_BASE}/customer/submit-invoice-request`, payload).subscribe({
      next: (res) => {
        if (res?.res) {
          this.invoiceCategory = null;
          this.invoiceMessage = '';
          this.submittedInvoice = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        // console.log(err);
      },
    });
  }

  /*--- Request Callback ---*/

  selectedDay: any = null;
  selectedTimeSlot: string = '';
  scheduleDescription: string = '';
  isScheduleLoading = false;
  scheduleErrorMessage = '';
  scheduleSuccessMessage = '';
  overrideStartDay: string | null = null;
  countryCode: string = '+49';
  phoneNumber: string = '';
  submittedCallback: boolean = false;

  readonly daysOfWeek = [
    { label: 'Montag', value: 'MONDAY' },
    { label: 'Dienstag', value: 'TUESDAY' },
    { label: 'Mittwoch', value: 'WEDNESDAY' },
    { label: 'Donnerstag', value: 'THURSDAY' },
    { label: 'Freitag', value: 'FRIDAY' },
    { label: 'Samstag', value: 'SATURDAY' },
  ];

  readonly timeSlots = [
    { label: '08:00 - 11:00 ', value: '08-11' },
    { label: '11:00 - 14:00', value: '11-14' },
    { label: '14:00 - 17:00', value: '14-17' },
    { label: '17:00 - 20:00', value: '17-20' },
  ];

  /** Maps day enum values to JS Date.getDay() numbers (0=Sun … 6=Sat). */
  private readonly dayValueToJsDay: Record<string, number> = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };
  availableDays: { date: string; day: string }[] = [];

  loadAvailableDays(): void {
    const payload = {
      adminId: 1,
    };

    this.http.post<any>(`${API_BASE}/customer/list-of-working-days`, payload).subscribe({
      next: (res) => {
        if (res?.res && res?.data) {
          this.availableDays = Object.entries(res.data).map(([date, day]) => ({
            date,
            day: day as string,
          }));

          // // console.log('Available Days:', this.availableDays);

          this.setDefaultSelectedDay();
        }
      },

      error: (err) => {
        console.error('Working days fetch error:', err);
      },
    });
  }
  resetCallbackForm(): void {
    this.selectedDay = null;
    this.selectedTimeSlot = '';

    this.phoneNumber = '';
    this.scheduleDescription = '';

    this.scheduleSuccessMessage = '';
    this.scheduleErrorMessage = '';

    this.fieldErrors = {};
  }
  get enabledDays(): Set<string> {
    const now = new Date();

    let todayJs: number;

    if (this.overrideStartDay) {
      todayJs = this.dayValueToJsDay[this.overrideStartDay];
    } else {
      todayJs = now.getDay();
      if (todayJs === 0) todayJs = 1;
    }

    const enabled = new Set<string>();

    for (let i = 0; i < 3; i++) {
      let day = todayJs + i;

      if (day > 6) {
        day = day - 6;
      }

      const entry = Object.entries(this.dayValueToJsDay).find(([, v]) => v === day);

      if (entry) {
        enabled.add(entry[0]);
      }
    }

    return enabled;
  }

  // get filteredDays() {
  //   return this.availableDays
  //     .map((item) => {
  //       const found = this.daysOfWeek.find((d) => d.value === item.day);

  //       return {
  //         ...found,
  //         date: item.date,
  //       };
  //     })
  //     .filter(Boolean);
  // }
  get filteredDays() {
    return this.availableDays
      .map((item) => {
        const found = this.daysOfWeek.find((d) => d.value === item.day);

        return {
          ...found,
          date: item.date,
        };
      })
      .filter((day: any) => {
        if (!day) return false;

        // If today, only show it if at least one time slot is available
        const todayStr = this.getBerlinTodayString();

        if (day.date === todayStr) {
          return this.timeSlots.some((slot) => this.isTimeSlotEnabled(slot.value));
        }

        // Future days → show normally
        return true;
      });
  }

  private getBerlinTodayString(): string {
    const berlinNow = new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Berlin',
      }),
    );

    const year = berlinNow.getFullYear();
    const month = String(berlinNow.getMonth() + 1).padStart(2, '0');
    const day = String(berlinNow.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
  isDayEnabled(dayValue: string): boolean {
    return this.availableDays.some((d) => d.day === dayValue);
  }

  private setDefaultSelectedDay(): void {
    if (this.filteredDays.length > 0) {
      this.selectedDay = this.filteredDays[0];
    }
  }

  getDayLabel(dateStr: string): string {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));

    today.setHours(0, 0, 0, 0);

    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    if (diffDays === 2) return 'Übermorgen';

    return target.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  getDayLabelByValue(dayValue: string): string {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));

    let todayJs = now.getDay();
    if (todayJs === 0) todayJs = 1;

    const targetJs = this.dayValueToJsDay[dayValue];

    let diff = targetJs - todayJs;
    if (diff < 0) diff += 7;

    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === 2) return 'Übermorgen';

    // 🔥 fallback → show date
    return this.formatDateByDayValue(dayValue);
  }
  formatDateByDayValue(dayValue: string): string {
    const dateStr = this.getDateFromDay(dayValue); // already returns YYYY-MM-DD
    const d = new Date(dateStr);

    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    }); // e.g. 10.05
  }
  trackByDay(index: number, item: any) {
    return item.date;
  }

  getSlotTime(slotValue: string): { start: number; end: number } | null {
    const parts = slotValue.split('-');

    if (parts.length !== 2) return null;

    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);

    return { start, end };
  }

  // isTimeSlotEnabled(slotValue: string): boolean {
  //   if (!this.selectedDay?.date) return true;

  //   const germanNow = new Date(
  //     new Date().toLocaleString('en-US', {
  //       timeZone: 'Europe/Berlin',
  //     }),
  //   );

  //   const todayStr = germanNow.toISOString().split('T')[0];

  //   const selectedDate = this.selectedDay.date;

  //   // future dates → all enabled
  //   if (selectedDate !== todayStr) {
  //     return true;
  //   }

  //   const currentHour = germanNow.getHours() + germanNow.getMinutes() / 60;

  //   const slot = this.getSlotTime(slotValue);

  //   if (!slot) return false;

  //   // already started
  //   if (currentHour >= slot.start) {
  //     return false;
  //   }

  //   // minimum 2h before
  //   return slot.start - currentHour >= 2;
  // }
  isTimeSlotEnabled(slotValue: string): boolean {
    if (!this.selectedDay?.date) {
      return true;
    }

    const berlinNow = new Date(
      new Date().toLocaleString('en-US', {
        timeZone: 'Europe/Berlin',
      }),
    );

    const todayStr = this.getBerlinTodayString();
    const selectedDate = this.selectedDay.date;

    // Future dates → all slots available
    if (selectedDate !== todayStr) {
      return true;
    }

    const currentHour = berlinNow.getHours() + berlinNow.getMinutes() / 60;

    const slot = this.getSlotTime(slotValue);

    if (!slot) {
      return false;
    }

    // Slot has already started
    if (currentHour >= slot.start) {
      return false;
    }

    // Must be at least 2 hours before slot starts
    return slot.start - currentHour >= 2;
  }
  getDateFromDay(dayValue: string): string {
    const now = new Date();

    const germanNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));

    let todayJs = germanNow.getDay();
    if (todayJs === 0) todayJs = 1;

    const targetJsDay = this.dayValueToJsDay[dayValue];

    let diff = targetJsDay - todayJs;

    if (diff < 0) diff += 7;

    const targetDate = new Date(germanNow);
    targetDate.setDate(germanNow.getDate() + diff);

    return targetDate.toISOString().split('T')[0];
  }

  selectDay(day: any): void {
    this.selectedDay = day;
    if (this.selectedTimeSlot && !this.isTimeSlotEnabled(this.selectedTimeSlot)) {
      this.selectedTimeSlot = '';
    }
    this.cdr.detectChanges();
  }

  selectTimeSlot(slot: string): void {
    if (!this.isTimeSlotEnabled(slot)) return;
    this.selectedTimeSlot = slot;
    this.cdr.detectChanges();
  }
  onNextPhone() {
    // console.log('Phone number entered:', this.phoneNumber);
    if (!this.validatePhone()) return;
  }

  validatePhone(): boolean {
    let valid = true;
    const errors: any = {};

    const mobile = (this.phoneNumber || '').toString().replace(/\s/g, '');

    if (!mobile) {
      errors['phoneNumber'] = 'Handynummer ist erforderlich.';
      valid = false;
    } else if (!/^\d+$/.test(mobile)) {
      errors['phoneNumber'] = 'Nur Zahlen sind erlaubt.';
      valid = false;
    } else if (mobile.length < 6) {
      errors['phoneNumber'] = 'Mindestens 6 Ziffern erforderlich.';
      valid = false;
      this.cdr.detectChanges();
    } else if (mobile.length > 12) {
      errors['phoneNumber'] = 'Maximal 12 Ziffern erlaubt.';
      valid = false;
      this.cdr.detectChanges();
    }

    this.fieldErrors = errors;
    // console.log('Validation errors:', this.fieldErrors);
    this.cdr.detectChanges();

    return valid;
  }
  submitDay(): void {
    this.scheduleErrorMessage = '';
    this.cdr.detectChanges();
    // console.log('select day:', this.selectedDay);

    if (!this.selectedDay) {
      this.scheduleErrorMessage = 'Bitte wählen Sie einen Tag und eine Uhrzeit aus.';
      // console.log('error', this.scheduleErrorMessage);
      return;
    }

    this.scheduleErrorMessage = '';
    this.scheduleSuccessMessage = '';
    this.isScheduleLoading = true;

    const payload = {
      adminId: 1,
      scheduleDate: this.selectedDay?.date,
    };

    // console.log('Schedule payload:', JSON.stringify(payload, null, 2));

    const submit = (apiBase: string) =>
      this.http.post<any>(`${apiBase}/api/check-holiday`, payload);

    submit(API_BASE).subscribe({
      next: (res) => {
        if (res?.res === true) {
          this.isScheduleLoading = false;

          this.cdr.detectChanges();
        } else if (res?.res === false && res?.holidayDated?.length) {
          this.isScheduleLoading = false;
          this.overrideStartDay = res.nextDay;
          this.selectedDay = '';

          const holidayDates = res.holidayDated.map((d: string) => this.formatDateDE(d)).join(', ');

          const firstNextDate = res.nextDate?.[0] ? this.formatDateDE(res.nextDate[0]) : '';
          const nextDay = this.getNextDayLabel(res.nextDay);

          this.scheduleErrorMessage =
            `Der ausgewählte Termin ist ein Urlaubstag. ` +
            `Bitte wählen Sie einen Termin ab dem ${firstNextDate} (${nextDay}).`;
          this.cdr.detectChanges();
        } else {
          this.isScheduleLoading = false;
          this.scheduleErrorMessage =
            res.errorMessage || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        submit(API_BASE).subscribe({
          next: () => {
            this.isScheduleLoading = false;

            this.cdr.detectChanges();
          },
          error: (err2) => {
            this.isScheduleLoading = false;
            this.scheduleErrorMessage =
              err2?.error?.message ||
              err?.error?.message ||
              'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
            console.error('Add-schedule API error:', err, err2);
            this.cdr.detectChanges();
          },
        });
        this.cdr.detectChanges();
      },
    });
  }

  getNextDayLabel(dayValue: string): string {
    const found = this.daysOfWeek.find((d) => d.value === dayValue);
    return found ? found.label : dayValue;
  }

  formatDateDE(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE'); // 01.05.2026
  }

  submitCallback() {
    this.scheduleErrorMessage = '';
    this.scheduleSuccessMessage = '';

    if (!this.validatePhone()) {
      return;
    }

    if (!this.selectedDay?.date) {
      this.scheduleErrorMessage = 'Bitte wählen Sie einen Wochentag aus.';
      return;
    }

    if (!this.selectedTimeSlot) {
      this.scheduleErrorMessage = 'Bitte wählen Sie eine Uhrzeit aus.';
      return;
    }

    if (!this.scheduleDescription?.trim()) {
      this.scheduleErrorMessage = 'Bitte geben Sie zusätzliche Informationen ein.';
      return;
    }

    this.isLoadingCallback = true;

    const payload = {
      mobileNumber: this.countryCode + this.phoneNumber,

      // actual backend values
      day: this.selectedDay.value,
      weekDay: this.selectedDay.label,
      scheduleDate: this.selectedDay.date,

      timeSlot: this.selectedTimeSlot,
      description: this.scheduleDescription.trim(),

      customerId: this.authService.getUserId() || 0,
      adminId: 1,
      egon_order_id: this.selectedMeter?.order?.orderId,
    };

    console.log('Final Payload:', payload);

    this.http.post<any>(`${API_BASE}/api/add-counselling-request`, payload).subscribe({
      next: (res) => {
        this.isLoadingCallback = false;

        if (res?.res === true) {
          this.scheduleSuccessMessage = 'Ihr Rückruf wurde erfolgreich geplant.';

          // reset form
          this.phoneNumber = '';
          this.selectedDay = null;
          this.selectedTimeSlot = '';
          this.scheduleDescription = '';
          this.submittedCallback = true;
          this.cdr.detectChanges();
        } else {
          this.scheduleErrorMessage =
            res?.message || 'Fehler beim Speichern. Bitte erneut versuchen.';
        }

        this.cdr.detectChanges();
      },

      error: (err) => {
        this.isLoadingCallback = false;

        this.scheduleErrorMessage =
          err?.error?.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';

        console.error('API error:', err);

        this.cdr.detectChanges();
      },
    });
  }

  redirectToMeter: boolean = false;
  openRequestService(item: any): void {
    // open service section
    this.activeTab = 3;
    this.currentStep = 1;

    console.log('==============================');
    console.log('Clicked Request Item:', item);
    console.log('Available Cards:', this.cards);

    // find matching card index safely
    const index = this.cards.findIndex((card: any, i: number) => {
      console.log('Checking Card Index:', i);
      console.log('Card Data:', card);

      const deliveryMatch =
        item?.deliveryId && card?.deliveryId && Number(card.deliveryId) === Number(item.deliveryId);

      const orderMatch =
        item?.orderId && card?.orderId && Number(card.orderId) === Number(item.orderId);

      console.log('Delivery Match:', deliveryMatch);
      console.log('Order Match:', orderMatch);

      return deliveryMatch || orderMatch;
    });

    console.log('Final Matched Index:', index);

    if (index !== -1) {
      this.selectedIndex = index;

      console.log('Selected Card:', this.cards[index]);
      this.resetCallbackForm();

      this.redirectToMeter = true;
      this.cdr.detectChanges();

      // existing card select function
      this.selectCard(index, this.cards[index].deliveryId);

      // horizontal auto scroll
      setTimeout(() => {
        const cards = document.querySelectorAll('.contract-service-card');

        const selectedCard = cards[index] as HTMLElement;

        if (selectedCard) {
          selectedCard.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });

          console.log('Scrolled to selected card');
        }
      }, 200);
    } else {
      this.redirectToMeter = false;
      console.warn('No matching card found');
    }

    // vertical scroll to section
    setTimeout(() => {
      const section = document.querySelector('.scroll-wrapper');

      if (section) {
        section.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });

        console.log('Scrolled to service section');
      }
    }, 100);

    this.cdr.detectChanges();
  }
  /*──  Send Message to energy supplier ──*/
  // CATEGORY OPTIONS

  // FORM VALUES
  supplierMessageCategories: any[] = [];

  supplierMessageCategory: number | null = null;
  supplierMessage: string = '';

  submittedEnergyMessage: boolean = false;
  isLoadingEnergySupplierMessage: boolean = false;

  getSupplierMessageStatus(item: any): string {
    const status = Number(item?.supplierMessage?.[0]?.status);

    if (status === 1) {
      return 'Im Gange';
    }

    if (status === 2) {
      return 'Weitergeleitet';
    }

    return '';
  }

  fetchSupplierMessageCategories(): void {
    this.http
      .post<any>(`${API_BASE}/customer/fetch-supplier-message-category`, { adminId: 1 })
      .subscribe({
        next: (res: any) => {
          if (res?.res) {
            this.supplierMessageCategories = res.data.map((item: any) => {
              return {
                label: item.categoryName,
                value: item.supplierMessageCategoryId,
              };
            });
          }

          this.cdr.detectChanges();
        },

        error: (err: any) => {
          console.error(err);
        },
      });
  }

  // SUBMIT
  submitEnergySupplierMessage(): void {
    this.fieldErrors = {};

    let hasError = false;

    // CATEGORY VALIDATION
    if (!this.supplierMessageCategory) {
      this.fieldErrors['supplierMessageCategory'] = 'Bitte wählen Sie eine Kategorie aus.';

      hasError = true;
    }

    // MESSAGE VALIDATION
    if (!this.supplierMessage?.trim()) {
      this.fieldErrors['supplierMessage'] = 'Bitte geben Sie eine Nachricht ein.';

      hasError = true;
    }

    if (hasError) {
      this.cdr.detectChanges();
      return;
    }

    // LOADING
    this.isLoadingEnergySupplierMessage = true;

    // PAYLOAD
    const payload = {
      supplierMessageCategoryId: Number(this.supplierMessageCategory),

      orderId: this.selectedMeter?.order?.orderId,

      message: this.supplierMessage.trim(),

      adminId: 1,

      customerId: Number(this.authService.getUserId()),
    };

    console.log('Supplier Message Payload:', payload);

    this.http.post<any>(`${API_BASE}/customer/add-supplier-message`, payload).subscribe({
      next: (res: any) => {
        this.isLoadingEnergySupplierMessage = false;

        this.submittedEnergyMessage = true;

        // RESET FORM
        this.supplierMessageCategory = 0;
        this.supplierMessage = '';

        this.cdr.detectChanges();
      },

      error: (err: any) => {
        console.error(err);

        this.isLoadingEnergySupplierMessage = false;

        this.cdr.detectChanges();
      },
    });
  }

  /* View contract details */
  viewContract(item: any) {
    const fileUrl = `${API_BASE}/assets/customers/${item.order.doc.signedFileUrl}`;

    window.open(fileUrl, '_blank');
  }
  /* Download contract */
  downloadContract(item: any) {
    const fileUrl = item.signedFileUrl;

    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.download = '';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* Change contract details */
  // component.ts

  contractDropdownOpen = false;
  contractOptionsList: { id: number; label: string }[] = [];
  isContractOptionsLoading = false;
  contractOptionsErrorMessage = '';

  selectedContractOptions: number[] = [];

  submittedSelections: number[] = [];

  contractChangeData: any = {
    lastName: '',
    companyName: '',
    title: '',
    firstName: '',
    salutation: '',
    dateOfBirth: '',
    billingPLZ: '',
    billingOrt: '',
    billingStreet: '',
    billingHouseNumber: '',
    deliveryHouseNumber: '',
    email: '',
    iban: '',
    accountHolder: '',
    phoneNumber: '',
    otherRequest: '',
  };

  uploadedContractDocuments: any = {};

  // error bags — keyed by field name

  // addressFieldErrors: { [key: string]: string } = {};

  fetchContractEditOptions(): void {
    this.isContractOptionsLoading = true;
    this.contractOptionsErrorMessage = '';

    this.http.post<any>(`${API_BASE}/customer/fetch-contract-edit-options`, {}).subscribe({
      next: (res) => {
        if (res?.res === true && Array.isArray(res?.contractOptionsList)) {
          this.contractOptionsList = res.contractOptionsList
            .filter((item: any) => item.status === 1)
            .map((item: any) => ({
              id: item.contractEditOptionId,
              label: item.contractEditOptionName,
            }));
        } else {
          this.contractOptionsErrorMessage =
            res?.errorMessage || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
        }
        this.isContractOptionsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isContractOptionsLoading = false;
        this.contractOptionsErrorMessage =
          err?.error?.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
        console.error('Fetch contract options API error:', err);
        this.cdr.detectChanges();
      },
    });
  }

  private readonly allowedDocumentTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/pdf',
  ];
  private readonly allowedDocumentExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

  onContractDocumentUpload(event: Event, key: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isValidType =
      this.allowedDocumentTypes.includes(file.type) ||
      this.allowedDocumentExtensions.includes(fileExtension);

    if (!isValidType) {
      this.fieldErrors[`${key}Document`] = 'Nur Bild- oder PDF-Dateien sind erlaubt.';
      this.uploadedContractDocuments[key] = null;
      input.value = ''; // reset the input so the invalid file isn't stuck in the picker
      this.cdr.detectChanges();
      return;
    }

    // clear any previous error for this field
    delete this.fieldErrors[`${key}Document`];

    this.uploadedContractDocuments[key] = file;
    this.cdr.detectChanges();
  }

  getContractOptionLabel(id: number): string {
    return this.contractOptionsList.find((x: any) => x.id === id)?.label || '';
  }
  toggleContractDropdown(): void {
    this.contractDropdownOpen = !this.contractDropdownOpen;
  }

  toggleContractSelection(optionId: number, event: Event): void {
    event.stopPropagation();

    const index = this.selectedContractOptions.indexOf(optionId);

    if (index > -1) {
      this.selectedContractOptions.splice(index, 1);
    } else {
      this.selectedContractOptions.push(optionId);
    }
  }
  private validateContractChanges(): boolean {
    this.fieldErrors = {};
    this.addressFieldErrors = {};
    let isValid = true;

    const requireField = (value: any, errorKey: string, message: string) => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        this.fieldErrors[errorKey] = message;
        isValid = false;
      }
    };

    const requireDocument = (docKey: string, errorKey: string, message: string) => {
      if (!this.uploadedContractDocuments[docKey]) {
        this.fieldErrors[errorKey] = message;
        isValid = false;
      }
    };

    // 1 — Last name
    if (this.submittedSelections.includes(1)) {
      requireField(
        this.contractChangeData.lastName,
        'lastName',
        'Bitte geben Sie Ihren neuen Nachnamen ein.',
      );
      requireDocument('lastName', 'lastNameDocument', 'Bitte laden Sie einen Nachweis hoch.');
    }

    // 2 — Company name
    if (this.submittedSelections.includes(2)) {
      requireField(
        this.contractChangeData.companyName,
        'companyName',
        'Bitte geben Sie den Firmennamen ein.',
      );
      requireDocument('companyName', 'companyNameDocument', 'Bitte laden Sie einen Nachweis hoch.');
    }

    // 3 — Title
    if (this.submittedSelections.includes(3)) {
      requireDocument('title', 'titleDocument', 'Bitte laden Sie einen Titelnachweis hoch.');
    }

    // 4 — First name
    if (this.submittedSelections.includes(4)) {
      requireField(
        this.contractChangeData.firstName,
        'firstName',
        'Bitte geben Sie Ihren neuen Vornamen ein.',
      );
    }

    // 5 — Salutation
    if (this.submittedSelections.includes(5)) {
      requireField(
        this.contractChangeData.salutation,
        'salutation',
        'Bitte wählen Sie eine Anrede.',
      );
    }

    // Shared proof for first name / salutation
    if (this.submittedSelections.includes(4) || this.submittedSelections.includes(5)) {
      requireDocument(
        'personData',
        'personDataDocument',
        'Bitte laden Sie eine Kopie des Personalausweises hoch.',
      );
    }

    // 6 — Date of birth
    if (this.submittedSelections.includes(6)) {
      requireField(
        this.contractChangeData.dateOfBirth,
        'dateOfBirth',
        'Bitte geben Sie Ihr Geburtsdatum ein.',
      );
      requireDocument(
        'dateOfBirth',
        'dateOfBirthDocument',
        'Bitte laden Sie eine Kopie des Personalausweises hoch.',
      );
    }

    // 7 — Billing address
    if (this.submittedSelections.includes(7)) {
      requireField(
        this.contractChangeData.billingPLZ,
        'billingPLZ',
        'Bitte geben Sie Ihre PLZ ein.',
      );
      requireField(
        this.contractChangeData.billingOrt,
        'billingOrt',
        'Bitte geben Sie den Ort ein.',
      );
      requireField(
        this.contractChangeData.billingStreet,
        'billingStreet',
        'Bitte geben Sie Ihre Straße ein.',
      );
      requireField(
        this.contractChangeData.billingHouseNumber,
        'billingHouseNumber',
        'Bitte geben Sie Ihre Hausnummer ein.',
      );
    }

    // 8 — Delivery/customer address
    if (this.submittedSelections.includes(8)) {
      if (!this.customerData?.address?.zip) {
        this.addressFieldErrors['zip'] = 'Bitte geben Sie Ihre PLZ ein.';
        isValid = false;
      }
      if (!this.customerData?.address?.city) {
        this.addressFieldErrors['city'] = 'Bitte geben Sie den Ort ein.';
        isValid = false;
      }
      if (!this.customerData?.address?.street) {
        this.addressFieldErrors['street'] = 'Bitte geben Sie Ihre Straße ein.';
        isValid = false;
      }
      if (!this.contractChangeData.deliveryHouseNumber?.trim()) {
        this.addressFieldErrors['houseNumber'] = 'Bitte geben Sie Ihre Hausnummer ein.';
        isValid = false;
      }
    }

    // 9 — Email
    if (this.submittedSelections.includes(9)) {
      const email = this.contractChangeData.email?.trim();
      if (!email) {
        this.fieldErrors['email'] = 'Bitte geben Sie Ihre neue E-Mail-Adresse ein.';
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.fieldErrors['email'] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        isValid = false;
      }
    }

    // 10 — Bank
    if (this.submittedSelections.includes(10)) {
      requireField(this.contractChangeData.iban, 'iban', 'Bitte geben Sie Ihre IBAN ein.');
      requireField(
        this.contractChangeData.accountHolder,
        'accountHolder',
        'Bitte geben Sie den Kontoinhaber ein.',
      );
    }
    // 11 — Phone Number
    if (this.submittedSelections.includes(11)) {
      requireField(
        this.contractChangeData.phoneNumber,
        'phoneNumber',
        'Bitte geben Sie Ihre Telefonnummer ein.',
      );
    }
    // 12 — Other
    if (this.submittedSelections.includes(12)) {
      requireField(
        this.contractChangeData.otherRequest,
        'otherRequest',
        'Bitte beschreiben Sie Ihre Anfrage.',
      );
    }

    return isValid;
  }
  submitContractSelection(): void {
    this.submittedSelections = [...this.selectedContractOptions];

    this.contractDropdownOpen = false;
  }

  @ViewChild('contractDropdownContainer') contractDropdownContainer!: ElementRef;

  private readonly contractDocClickHandler = (event: Event) => {
    if (
      this.contractDropdownOpen &&
      this.contractDropdownContainer &&
      !this.contractDropdownContainer.nativeElement.contains(event.target)
    ) {
      this.contractDropdownOpen = false;
      this.cdr.markForCheck();
    }
  };
  contractChangeSuccess = false;
  contractChangeSuccessMessage = '';

  submitContractChanges(): void {
    if (!this.validateContractChanges()) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.field-error, .error-hint');
        firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      return;
    }

    const formData = new FormData();
    const deliveryId = this.contractChangeData?.deliveryId ?? this.selectedMeter?.id;

    if (!deliveryId) {
      console.error('deliveryId is missing — check selectedMeter/contractChangeData source');
      return;
    }

    const jsonPayload: any = {
      selectedOption: this.submittedSelections,
      deliveryId: deliveryId,
    };
    // 1 — Last name
    if (this.submittedSelections.includes(1)) {
      jsonPayload.lastName = this.contractChangeData.lastName;
      if (this.uploadedContractDocuments['lastName']) {
        formData.append('lastNameProof', this.uploadedContractDocuments['lastName']);
      }
    }

    // 2 — Company name
    if (this.submittedSelections.includes(2)) {
      jsonPayload.companyName = this.contractChangeData.companyName;
      if (this.uploadedContractDocuments['companyName']) {
        formData.append('companyProof', this.uploadedContractDocuments['companyName']);
      }
    }

    // 3 — Title
    if (this.submittedSelections.includes(3)) {
      jsonPayload.title = this.contractChangeData.title;
      if (this.uploadedContractDocuments['title']) {
        formData.append('titleProof', this.uploadedContractDocuments['title']);
      }
    }

    // 4 / 5 — First name & salutation (shared ID proof)
    if (this.submittedSelections.includes(4) || this.submittedSelections.includes(5)) {
      if (this.submittedSelections.includes(4)) {
        jsonPayload.firstName = this.contractChangeData.firstName;
      }
      if (this.submittedSelections.includes(5)) {
        jsonPayload.salutation = this.contractChangeData.salutation;
      }
      if (this.uploadedContractDocuments['personData']) {
        formData.append('firstSalProof', this.uploadedContractDocuments['personData']);
      }
    }

    // 6 — Date of birth
    if (this.submittedSelections.includes(6)) {
      jsonPayload.dob = this.contractChangeData.dateOfBirth;
      if (this.uploadedContractDocuments['dateOfBirth']) {
        formData.append('dobProof', this.uploadedContractDocuments['dateOfBirth']);
      }
    }

    // 9 — Email
    if (this.submittedSelections.includes(9)) {
      jsonPayload.email = this.contractChangeData.email;
    }

    // 11 — Phone number
    if (this.submittedSelections.includes(11)) {
      jsonPayload.phoneNumber = this.contractChangeData.phoneNumber;
    }

    // 12 — Other
    if (this.submittedSelections.includes(12)) {
      jsonPayload.others = this.contractChangeData.otherRequest;
    }

    // 7 (billing address), 8 (customer/delivery address), 10 (bank) skipped for now —
    // will be wired in separately once their submit flow is finalized.

    formData.append(
      'metaData',
      new Blob([JSON.stringify(jsonPayload)], { type: 'application/json' }),
    );

    this.http.post<any>(`${API_BASE}/customer/edit-contract-details`, formData).subscribe({
      next: (res) => {
        if (res?.res) {
          console.log('Contract details updated successfully');

          this.contractChangeSuccessMessage =
            res?.message || 'Ihre Anfrage wurde erfolgreich gesendet.';
          this.contractChangeSuccess = true;

          this.resetContractChangeForm();
          this.cdr.detectChanges();

          // auto redirect back to step 1 after showing success for a bit
          setTimeout(() => {
            this.contractChangeSuccess = false;
            // this.activeTab = 1;
            // this.currentStep = 1; // or whatever the "start" step is
            this.cdr.detectChanges();
          }, 3000);
        } else {
          console.error('Update failed', res);
        }
      },
      error: (err) => {
        console.error('Error submitting contract changes', err);
      },
    });
  }

  removeContractField(optionId: number | number[]): void {
    const ids = Array.isArray(optionId) ? optionId : [optionId];

    this.submittedSelections = this.submittedSelections.filter((id) => !ids.includes(id));
    this.selectedContractOptions = this.selectedContractOptions.filter((id) => !ids.includes(id));

    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.contractDocClickHandler, true);
  }

  resetContractChangeForm(): void {
    this.contractDropdownOpen = false;
    this.selectedContractOptions = [];
    this.submittedSelections = [];

    this.contractChangeData = {
      lastName: '',
      companyName: '',
      title: '',
      firstName: '',
      salutation: '',
      dateOfBirth: '',
    };

    this.uploadedContractDocuments = {};
  }

  /* Change Discount Payment */

  newDiscountAmount: string = '';
  discountReason: string = '';

  submittedDiscountRequest = false;
  isLoadingDiscountRequest = false;

  getDiscountStatus(item: any): string {
    const status = item?.discountRequests?.[0]?.status;

    if (status === 0) {
      return 'Im Gange';
    }

    if (status === 1) {
      return 'Weitergeleitet';
    }

    return '';
  }

  validateDiscountRequest(): boolean {
    this.fieldErrors = {};

    let isValid = true;

    if (!this.newDiscountAmount || Number(this.newDiscountAmount) <= 0) {
      this.fieldErrors['newDiscountAmount'] = 'Bitte neuen Abschlagsbetrag eingeben';

      isValid = false;
    }

    if (!this.discountReason?.trim()) {
      this.fieldErrors['discountReason'] = 'Bitte Grund der Änderung eingeben';

      isValid = false;
    }

    return isValid;
  }

  submitDiscountRequest() {
    if (!this.validateDiscountRequest()) {
      return;
    }

    const payload = {
      customerId: this.authService.getUserId(),

      deliveryId: this.selectedMeter?.deliveryId,

      newAdvanceAmount: this.newDiscountAmount,

      reason: this.discountReason,
      orderId: this.selectedMeter?.order?.orderId,
    };

    console.log('Discount Payload:', payload);

    this.isLoadingDiscountRequest = true;

    this.http.post<any>(`${API_BASE}/customer/change-discount-request`, payload).subscribe({
      next: (res) => {
        this.isLoadingDiscountRequest = false;

        if (res?.res === true) {
          this.submittedDiscountRequest = true;

          this.newDiscountAmount = '';
          this.discountReason = '';

          this.cdr.detectChanges();
        } else {
          console.error('Invalid response', res);
        }
      },

      error: (err) => {
        this.isLoadingDiscountRequest = false;

        console.error('API Error:', err);
      },
    });
  }

  /* Cancellation Service */

  cancellationCategories: { id: number; categoryName: string; status: number }[] = [];

  cancellationData: any = {
    categoryId: '',
    terminationType: '',
    effectiveDate: '',
    additionalInfo: '',
  };
  fetchCancellationCategories(): void {
    this.http.post<any>(`${API_BASE}/customer/fetch-contract-cancellation-category`, {}).subscribe({
      next: (res) => {
        if (res?.res && Array.isArray(res.data)) {
          // only show active categories
          this.cancellationCategories = res.data.filter((c: any) => c.status === 1);
        } else {
          console.error('Failed to load cancellation categories', res);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching cancellation categories', err);
      },
    });
  }

  openDatePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.focus();
    }
  }

  onTerminationTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.cancellationData.terminationType = value;
    this.cdr.detectChanges();
  }

  cancellationReason: string = '';

  isSubmittingCancellation: boolean = false;

  submitCancellation(): void {
    this.fieldErrors = {};
    this.scheduleSuccessMessage = '';
    this.scheduleErrorMessage = '';

    // Required-field validation — additionalInfo is the only optional field
    if (!this.cancellationData.categoryId) {
      this.fieldErrors['categoryId'] = 'Bitte wählen Sie einen Kündigungsgrund aus.';
    }
    if (!this.cancellationReason?.trim()) {
      this.fieldErrors['reason'] = 'Bitte beschreiben Sie den genauen Grund.';
    }
    if (!this.cancellationData.effectiveDate) {
      this.fieldErrors['effectiveDate'] = 'Bitte wählen Sie ein Kündigungsdatum aus.';
    }
    if (!this.cancellationData.terminationType) {
      this.fieldErrors['terminationType'] = 'Bitte wählen Sie die Art der Kündigung aus.';
    }
    if (!String(this.phoneNumber ?? '').trim()) {
      this.fieldErrors['phoneNumber'] = 'Bitte geben Sie Ihre Telefonnummer an.';
    }
    if (!this.selectedDay) {
      this.fieldErrors['selectedDay'] = 'Bitte wählen Sie einen Wochentag.';
    }
    if (!this.selectedTimeSlot) {
      this.fieldErrors['selectedTimeSlot'] = 'Bitte wählen Sie eine Uhrzeit.';
    }
    if (!this.scheduleDescription?.trim()) {
      this.fieldErrors['scheduleDescription'] = 'Bitte geben Sie weitere Informationen an.';
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      this.cdr.detectChanges();
      return; // stop — do not call the API
    }

    const payload = {
      deliveryId: this.selectedMeter?.deliveryId ?? this.selectedMeter?.id,
      reason: this.cancellationReason.trim(),
      desiredDate: this.cancellationData.effectiveDate,
      terminationType:
        this.cancellationData.terminationType === 'ordinary'
          ? 'Ordinary Termination'
          : 'Extraordinary Termination',
      additionalInfo: this.cancellationData.additionalInfo?.trim() || '', // optional
      selectedCategoryId: this.cancellationData.categoryId,
      mobileNumber: this.phoneNumber,
      weekDay: this.selectedDay?.date,
      timeSlot: this.selectedTimeSlot,
      description: this.scheduleDescription.trim(),
    };

    this.isSubmittingCancellation = true;

    this.http.post<any>(`${API_BASE}/customer/request-contract-cancellation`, payload).subscribe({
      next: (res) => {
        this.isSubmittingCancellation = false;
        if (res?.res) {
          this.scheduleSuccessMessage =
            res.message || 'Ihre Anfrage wurde erfolgreich übermittelt.';
          this.submittedCallback = true;
          this.resetCancellationForm(); // <-- add this
          this.scheduleSuccessMessage =
            res.message || 'Ihre Anfrage wurde erfolgreich übermittelt.'; // re-set after reset clears it
        } else {
          this.scheduleErrorMessage =
            res?.message || 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmittingCancellation = false;
        console.error('Error submitting cancellation request', err);
        this.scheduleErrorMessage = 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.';
        this.cdr.detectChanges();
      },
    });
  }

  resetCancellationForm(): void {
    this.cancellationData = {
      categoryId: '',
      terminationType: '',
      effectiveDate: '',
      additionalInfo: '',
    };
    this.cancellationReason = '';
    this.phoneNumber = '';
    this.selectedDay = null;
    this.selectedTimeSlot = '';
    this.scheduleDescription = '';
    this.fieldErrors = {};
    this.scheduleSuccessMessage = '';
    this.scheduleErrorMessage = '';
  }

  getMeterCancellationStatus(item: any): string {
    const status = item?.requestcancellation;

    if (status === 1) {
      return 'Im Gange';
    }

    if (status === 2) {
      return 'Weitergeleitet';
    }

    return '';
  }

  /*── Meter Section end ──*/
  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /*── Reminder Section Start ──*/
  selection: string = 'yes';
  showReminderModal: boolean = false;

  selectOption(value: string): void {
    if (value === 'no') {
      this.showReminderModal = true;
      return;
    }

    if (value === 'yes') {
      this.selection = 'yes';
      this.toggleNotification(true);
    }
  }

  closeModal() {
    this.showReminderModal = false;
  }

  toggleNotification(isNotificationEnabled: boolean = false): void {
    const customerId = this.authService.getUserId() || 0;

    const body = {
      id: customerId,
      adminId: 1,
      isNotificationEnabled: isNotificationEnabled,
    };

    this.http.post<any>(`${API_BASE}/customer/toggle-customer-notification`, body).subscribe({
      next: (res) => {
        if (!res?.res) {
          console.error('Invalid response');
          return;
        }

        if (isNotificationEnabled === false) {
          this.selection = 'no';
        } else {
          this.selection = 'yes';
        }
        this.isNotificationEnabled = isNotificationEnabled;
        this.showReminderModal = false;

        // console.log(res.message);

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('API Error:', err);
      },
    });
  }
  toggleDeliveryNotification(contract: any): void {
    const payload = {
      customerId: this.authService.getUserId(),
      deliveryId: contract.deliveryId,
    };

    this.http.post<any>(`${API_BASE}/customer/toggle-delivery-notification`, payload).subscribe({
      next: (res: any) => {
        if (res?.res) {
          // console.log('Notification updated successfully');
        }
      },

      error: (err) => {
        // revert toggle if API fails
        contract.enabled = !contract.enabled;

        console.error('Failed to update notification', err);
      },
    });
  }

  groupedContracts: any[] = [];

  private fetchDeliveryByAddress(): void {
    const customerId = this.authService.getUserId() || 0;
    console.log('Fetching deliveries for customer ID:', customerId);
    const body = {
      id: customerId,
      adminId: 1,
    };

    this.http.post<any>(`${API_BASE}/customer/fetch-customer-delivery-group`, body).subscribe({
      next: (res) => {
        if (!res?.res || !res?.data) {
          console.error('Invalid response');
          return;
        }

        console.log('Raw API Response:', res);
        const groupedData = res.data;

        let index = 1;

        this.groupedContracts = Object.keys(groupedData)
          .map((addressKey) => {
            const deliveries = groupedData[addressKey];

            const contracts = deliveries
              .filter((item: any) => item?.order?.orderId != null)
              .map((item: any) => this.mapToContract(item));

            return {
              addressKey,
              contracts,
            };
          })
          .filter((group) => group.contracts.length > 0)
          .map((group, index) => {
            return {
              ...group,
              addressLabel: `Haushalt ${index + 1}`,
            };
          });

        // console.log('Grouped Contracts:', this.groupedContracts);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('API Error:', err);
      },
    });
  }

  shouldShowContractActions(startTimestamp: number, durationMonths: number): boolean {
    if (!startTimestamp || !durationMonths) {
      return false;
    }

    const showDate = new Date(startTimestamp * 1000);

    // minimum term - 12 months
    const monthsBeforeEnd = durationMonths - 12;

    showDate.setMonth(showDate.getMonth() + monthsBeforeEnd);

    const today = new Date();

    return today >= showDate;
  }
  mapToContract(item: any) {
    const provider = item.provider || {};
    const connection = item.connection || {};
    const address = item.customerAddress || {};
    const order = item.order || {};

    return {
      connection: connection,
      billingAddress: item.billingAddress,
      customer: item.customer,
      customerAddress: address,
      logo: provider.providerSVG || 'assets/icons/default.png',
      title: provider.rateName || 'N/A',
      icon: this.getIconByBranch(provider.branch),
      type: this.getType(provider.branch),
      meter: connection.meterNumber || 'N/A',
      name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'N/A',
      address: this.formatAddress(address),
      zip: address.zip || 'N/A',
      city: address.city || 'N/A',
      street: address.street || 'N/A',
      houseNumber: address.houseNumber || 'N/A',
      consumption: item.consumption ? `${item.consumption}` : this.consumption,
      persons: item.persons || this.person,
      deliveryId: item.deliveryId,
      notificationEnabled: item.notificationEnabled ?? true,
      contractNumber: item.uniqueDeliveryId || 'N/A',
      customerNumber: item.mobile || 'N/A',
      duration: this.getDuration(order?.operationPeriod),
      endOfDuration: this.getExpiryDate(order?.expiryOn),
      startDate: this.formatDateReminder(item.orderPlacedOn),
      renewal: this.getRenewalDate(item),
      price: this.formatWorkPrice(provider),
      basePrice: this.formatBasePrice(provider),
      monthly: this.formatMonthly(provider),
      cancelDate: this.getCancelDate(order?.lastDateOfCancellation),
      showActions: this.shouldShowContractActions(
        item.orderPlacedOn,
        this.getDurationMonths(provider),
      ),
    };
  }
  person = 2;
  consumption = 2510;

  compareNew(contract: any) {
    // console.log('Comparing contract:', contract);
    if (!contract.zip || !contract.city || !contract.street || !contract.houseNumber) {
      console.error('Invalid contract data');
      return;
    }

    const data = {
      zip: contract.zip,
      city: contract.city,
      street: contract.street,
      houseNumber: contract.houseNumber,
      persons: contract.persons,
      consumption: contract.consumption,
    };

    // console.log('Saving address:', data);

    this.authService.setAddressData(data);
    this.authService.setSelectedContract(contract);

    this.router.navigate(['/electricity-comparision']);
  }

  getDurationMonths(provider: any): number {
    return Number(provider?.optTerm || 0);
  }

  getExpiryDate(timestamp: number): string {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp * 1000);

    return date.toLocaleDateString('de-DE');
  }

  getEndOfDuration(startTimestamp: number, months: number): string {
    if (!startTimestamp || !months) return 'N/A';

    const date = new Date(startTimestamp * 1000);

    // add months
    date.setMonth(date.getMonth() + months);

    // minus 1 day
    date.setDate(date.getDate() - 1);

    return date.toLocaleDateString('de-DE');
  }

  // ===============================
  //  TYPE & ICON
  // ===============================
  getType(branch: string | null): string {
    if (branch === 'electric') return 'Strom | Hausstrom';
    if (branch === 'gas') return 'Gas';
    return 'N/A';
  }

  getIconByBranch(branch: string | null): string {
    if (branch === 'electric') {
      return 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png';
    }
    if (branch === 'gas') {
      return 'assets/icons/1a9ebeaf-78b8-48a3-9514-94f57aa1de2c_Gasvergleich.png';
    }
    return 'assets/icons/default.png';
  }

  // ===============================
  //  ADDRESS FORMAT
  // ===============================
  formatAddress(addr: any): string {
    if (!addr) return 'N/A';

    const street = addr.street || '';
    const house = addr.houseNumber || '';
    const zip = addr.zip || '';
    const city = addr.city || '';

    const result = `${street} ${house}, ${zip} ${city}`.trim();

    return result || 'N/A';
  }

  // ===============================
  //  DATE FORMAT (timestamp → German)
  // ===============================
  formatDateReminder(timestamp: number | null): string {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('de-DE');
  }

  // ===============================
  //  DURATION (not available → fallback)
  // ===============================
  getDuration(operationPeriod: number | null): string {
    if (!operationPeriod) return 'N/A';

    // convert seconds -> months
    const months = Math.floor(operationPeriod / (60 * 60 * 24 * 30));

    return `${months} Monate`;
  }

  // ===============================
  //  RENEWAL (NOT IN API)
  // ===============================
  getRenewalDate(item: any): string {
    const startTimestamp = item?.orderPlacedOn;
    const months = Number(item?.provider?.optTerm || 0);

    if (!startTimestamp || !months) {
      return 'N/A';
    }

    const date = new Date(startTimestamp * 1000);

    // add contract term months
    date.setMonth(date.getMonth() + months);

    return date.toLocaleDateString('de-DE');
  }

  // ===============================
  //  CANCEL DATE (NOT IN API)
  // ===============================
  getCancelDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('de-DE');
  }

  // ===============================
  // PRICE FORMAT
  // ===============================
  formatWorkPrice(provider: any): string {
    if (!provider?.workPrice) return 'N/A';
    return `${provider.workPrice} Ct./kWh`;
  }

  formatBasePrice(provider: any): string {
    if (!provider?.basePriceMonth) return 'N/A';
    return `${provider.basePriceMonth} €/Monat`;
  }

  formatMonthly(provider: any): string {
    if (!provider?.totalPriceMonth) return 'N/A';
    return `${Number(provider.totalPriceMonth).toFixed(2)} €`;
  }

  /*── Reminder Section End ──*/
  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/

  /*── Service Section Start ──*/

  showList = true;
  showDetails = false;
  confirmationList = false;
  showDropdown = false;
  selectedIndex: number = -1; // -1 = Orange card selected by default
  selectedCategory: any = null;
  selectedDeliveryId: number = 0;
  title: string = '';
  inquiryText: string = '';
  categories: { serviceId: number; serviceName: string; serviceType: string }[] = [];
  messages: any[] = [];
  currentServiceRequestId: number = 0;
  newMessage: string = '';

  openCount: number = 0;
  closedCount: number = 0;
  progressCount: number = 0;

  openRequests: any[] = [];
  inProgressRequests: any[] = [];
  closedRequests: any[] = [];

  fetchAllRequests() {
    const payload = {
      id: this.authService.getUserId(),
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/fetch-all-requests`, payload).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (!res?.res) {
          console.error('Invalid response');
          this.resetRequests();
          return;
        }

        this.openRequests = this.mapRequests(res.openRequests || []);
        this.inProgressRequests = this.mapRequests(res.inProgressRequets || []);
        this.closedRequests = this.mapRequests(res.closedRequests || []);
        this.cdr.detectChanges();

        // console.log('All Requests:', res);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
        this.resetRequests();
      },
    });
  }

  mapRequests(list: any[]) {
    return list.map((item: any) => ({
      title: item.title,
      category: item.serviceName,
      ticketNumber: item.ticketNumber,
      createdOn: item.createdOn,
      closedOn: item.requestClosedOn,
      serviceRequestId: item.serviceRequestId,

      // UI helpers
      date: this.formatDateOnly(item.createdOn),
      status: item.isClosed ? 'closed' : item.inProgress ? 'progress' : 'open',
    }));
  }

  resetRequests() {
    this.openRequests = [];
    this.inProgressRequests = [];
    this.closedRequests = [];
  }

  fetchServiceCount() {
    const payload = {
      id: this.authService.getUserId(),
    };

    this.http.post<any>(`${API_BASE}/customer/fetch-service-count`, payload).subscribe({
      next: (res) => {
        if (!res?.res) {
          console.error('Invalid response');
          return;
        }

        this.openCount = res.open ?? 0;
        this.closedCount = res.closed ?? 0;
        this.progressCount = res.progress ?? 0;
        this.cdr.detectChanges();

        // console.log('Counts:', res);
      },
      error: (err) => {
        console.error('API Error:', err);
      },
    });
  }

  private fetchCategories(serviceType: string): void {
    this.isLoading = true;
    const body = {
      adminId: 1,
      serviceType: serviceType,
    };
    this.http.post<any>(`${API_BASE}/customer/fetch-cutomer-service`, body).subscribe({
      next: (res) => {
        if (!res?.res || !res?.data) {
          console.error('Invalid response');
          this.categories = [];
          this.isLoading = false;
          return;
        }

        // this.categories = res.data.map((item: any) => item.serviceName || '');

        this.categories = res.data.map((item: any) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName || '',
        }));

        // console.log('categories:', this.categories);

        this.cdr.detectChanges();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        this.categories = [];
        this.isLoading = false;
      },
    });
  }

  selectCard(index: number, deliveryId: number) {
    this.selectedIndex = index;
    this.selectedDeliveryId = deliveryId;
    this.selectedCategory = '';
    this.fetchCategories('delivery');
    this.cdr.detectChanges();
  }

  selectOrangeCard() {
    this.selectedIndex = -1;
    this.selectedDeliveryId = 0;
    this.selectedCategory = '';
    this.fetchCategories('general');
    this.cdr.detectChanges();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }

  selectCategory(item: any, event: Event) {
    event.stopPropagation();
    this.selectedCategory = item;
    this.showDropdown = false;
  }

  validateForm(): boolean {
    this.fieldErrors = {};

    let isValid = true;

    if (!this.title || !this.title.trim()) {
      this.fieldErrors['title'] = 'Bitte Titel eingeben';
      isValid = false;
    }

    if (!this.selectedCategory) {
      this.fieldErrors['category'] = 'Bitte Kategorie wählen';
      isValid = false;
    }

    if (!this.inquiryText || !this.inquiryText.trim()) {
      this.fieldErrors['inquiryText'] = 'Bitte Anfragetext eingeben';
      isValid = false;
    }

    // OPTIONAL CALLBACK VALIDATION
    // Only validate if phone number entered
    if (this.phoneNumber) {
      if (!this.selectedDay) {
        this.fieldErrors['selectedDay'] = 'Bitte wählen Sie einen Wochentag';
        isValid = false;
      }

      if (!this.selectedTimeSlot) {
        this.fieldErrors['selectedTimeSlot'] = 'Bitte wählen Sie eine Uhrzeit';
        isValid = false;
      }
    }

    return isValid;
  }

  submitRequest() {
    if (!this.validateForm()) return;

    const payload = {
      customerId: this.authService.getUserId(),
      title: this.title,
      serviceId: this.selectedCategory.serviceId,
      message: this.inquiryText,
      serviceRequestType: this.selectedIndex === -1 ? 'general' : 'delivery',
      deliveryId: this.selectedDeliveryId,

      // OPTIONAL CALLBACK DATA
      callbackRequest: !!this.phoneNumber,

      phoneNumber: this.phoneNumber || '',
      countryCode: this.countryCode || '',

      callbackDate: this.selectedDay?.date || '',
      callbackTimeSlot: this.selectedTimeSlot || '',

      callbackDescription: this.scheduleDescription || '',
    };

    // console.log('Final Payload:', payload);

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/add-service-request`, payload).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res?.res === true) {
          // console.log('Request submitted successfully');

          this.fetchAllRequests();
          this.fetchServiceCount();
          this.toggleService(2);

          this.resetForm();
          this.cdr.detectChanges();
        } else {
          console.error('Invalid response', res);
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
      },
    });
  }

  resetForm() {
    this.title = '';
    this.selectedCategory = null;
    this.inquiryText = '';
    this.selectedIndex = -1;
    this.selectedDeliveryId = 0;
    this.clearPwdField();
    this.fieldErrors = {};
  }

  @ViewChild('dropdownContainer') dropdownContainer!: ElementRef;

  // Outside click listener
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (
      this.showDropdown &&
      this.dropdownContainer &&
      !this.dropdownContainer.nativeElement.contains(event.target)
    ) {
      this.showDropdown = false;
    }
  }

  openDetails(serviceRequestId: number) {
    this.showList = false;
    this.showDetails = true;
    this.fetchMessages(serviceRequestId);
  }

  isClosed: boolean = false;
  chatCategory: string = '';
  chatTitle: string = '';
  requestClosedOn: number | null = null;
  createdOn: number | null = null;
  reopenReason: string = '';

  fetchMessages(serviceRequestId: number) {
    const payload = {
      serviceRequestId: serviceRequestId,
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/fetch-request-messages`, payload).subscribe({
      next: ({ res, data }) => {
        this.isLoading = false;

        if (res && data) {
          this.isClosed = data.isClosed;
          this.chatCategory = data.serviceName;
          this.chatTitle = data.title;
          this.createdOn = data.createdOn;
          this.currentServiceRequestId = serviceRequestId;
          this.requestClosedOn = data.requestClosedOn ?? null;
          this.messages = data.messages.map((item: any) => ({
            message: item.message.replace(/\n/g, '<br>'),
            type: item.chatUser === 'CUSTOMER' ? 'customer' : 'admin',
            title: `${
              item.chatUser === 'CUSTOMER'
                ? 'Ihre Nachricht an den Berater vom'
                : 'Antwort vom Berater'
            } • ${this.formatDate(item.sendOn)}`,
          }));

          this.cdr.detectChanges();
          // console.log('messages:', this.messages);
        } else {
          this.messages = [];
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
        this.messages = [];
      },
    });
  }

  sendMessage(serviceRequestId: number) {
    if (!this.newMessage || !this.newMessage.trim()) return;

    const payload = {
      serviceRequestId: serviceRequestId,
      customerId: this.authService.getUserId(),
      message: this.newMessage,
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/add-service-request`, payload).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res?.res === true) {
          this.messages.push({
            message: res.messageBody.replace(/\n/g, '<br>'),
            type: 'customer',
            title: `Ihre Nachricht an den Berater vom • ${this.formatDate(res.sendOn)}`,
          });

          this.newMessage = '';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
      },
    });
  }

  validateReopen(): boolean {
    this.fieldErrors = {};

    if (!this.reopenReason || !this.reopenReason.trim()) {
      this.fieldErrors['reopenReason'] = 'Bitte Grund eingeben';
      return false;
    }

    return true;
  }

  clearServiceId() {
    this.currentServiceRequestId = 0;
  }

  reOpenservice(serviceRequestId: number) {
    if (!this.validateReopen()) return;

    const payload = {
      serviceRequestId: serviceRequestId,
      customerId: this.authService.getUserId(),
      message: this.reopenReason,
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/add-service-request`, payload).subscribe({
      next: (res) => {
        this.isLoading = false;

        if (res?.res) {
          this.reopenReason = '';

          this.toggleService(2);
          this.clearServiceId();
          this.fetchServiceCount();
          this.cdr.detectChanges();

          // console.log('Reopened successfully');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
      },
    });
  }

  formatDateOnly(timestamp: number): string {
    const date = new Date(timestamp * 1000);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} - ${hours}:${minutes} Uhr`;
  }

  toggleService(step: number) {
    this.serviceTab = step;

    this.showList = true;
    this.showDetails = false;
    this.confirmationList = false;
    if (this.activeTab === 3 && (step === 2 || step === 3 || step == 4)) {
      this.fetchServiceCount();
      this.fetchAllRequests();
    }
    this.redirectToMeter = false;
    this.resetForm();
    this.cdr.detectChanges();
  }

  backToList() {
    this.showList = true;
    this.showDetails = false;
  }

  confirmation(serviceRequestId: number) {
    this.showList = false;
    this.showDetails = false;
    this.confirmationList = true;
  }

  cards: any[] = [];

  private fetchCards(): void {
    const customerId = this.authService.getUserId() || 0;

    const body = {
      id: Number(customerId),
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/fetch-placed-deliveries`, body).subscribe({
      next: (res) => {
        if (!res?.res || !res?.delivery) {
          console.error('Invalid response');
          this.cards = [];
          this.isLoading = false;
          return;
        }

        this.cards = res.delivery
          .filter((item: any) => item?.order?.orderId != null)
          .map((item: any) => {
            const address = item?.customerAddress;

            return {
              logo: item?.provider?.providerSVG || 'assets/default.png',

              title: item?.provider?.rateName || '',
              deliveryId: item?.deliveryId || 0,

              date: item?.orderPlacedOn
                ? new Date(item.orderPlacedOn * 1000).toLocaleDateString('de-DE')
                : '',

              data: [
                {
                  label: 'Zählernummer:',
                  value: item?.connection?.meterNumber || '',
                  icon: 'meter',
                },
                {
                  label: 'Adresse:',
                  value: address
                    ? `${address.street || ''} ${address.houseNumber || ''}, ${address.zip || ''} ${address.city || ''}`
                    : '',
                  icon: 'home',
                },
                {
                  label: 'Stromtyp:',
                  value: item?.provider?.branch || '',
                  icon: 'current',
                },
                {
                  label: 'Vertragsnummer:',
                  value: item?.uniqueDeliveryId || '',
                  icon: 'doc',
                },
              ],
            };
          });

        // console.log('cards:', this.cards);

        // dynamic electricity list
        this.electricityList = res.delivery
          .filter((item: any) => item?.order?.orderId)
          .map((item: any): any => {
            const address = item?.customerAddress;
            const provider = item?.provider;
            const connection = item?.connection;
            const customer = item?.customer;
            const order = item?.order;

            return {
              deliveryId: item?.deliveryId || 0,
              type: provider?.branch === 'gas' ? 'gas' : 'electricity',

              status: order?.orderId ? 'Vertrag aktiv' : 'In Bearbeitung',

              order: order,

              meterIcon: provider?.providerSVG || 'assets/default.png',

              providerIcon:
                provider?.branch === 'gas'
                  ? 'assets/icons/1a9ebeaf-78b8-48a3-9514-94f57aa1de2c_Gasvergleich.png'
                  : 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png',

              providerType: provider?.branch === 'gas' ? 'Gas' : 'Strom | Hausstrom',

              tariff: provider?.rateName || '',

              contractNumber: item?.uniqueDeliveryId || '',

              customerNumber: connection?.customerNumber || 'N/A',

              minimumTerm: provider?.optTerm ? `${provider.optTerm} Monate` : 'N/A',

              orderDate: item?.orderPlacedOn
                ? new Date(item.orderPlacedOn * 1000).toLocaleDateString('de-DE')
                : 'N/A',

              contractStart: connection?.desiredDelivery
                ? new Date(connection.desiredDelivery * 1000).toLocaleDateString('de-DE')
                : 'N/A',

              noticePeriod: 'N/A',
              contractEnd: 'N/A',

              workPrice: provider?.workPrice ? `${provider.workPrice} Ct./kWh` : 'N/A',

              basePrice: provider?.basePriceMonth ? `${provider.basePriceMonth} €/Monat` : 'N/A',

              monthlyPrice: provider?.totalPriceMonth ? `${provider.totalPriceMonth} €` : 'N/A',

              meterNumber: connection?.meterNumber || 'N/A',

              meterDesignation: connection?.meterDesignation || connection?.meterNumber || 'N/A',

              marketLocation: connection?.marketLocationId || 'N/A',

              // Meter designation same as meter number
              meterName: connection?.meterNumber || 'N/A',
              id: connection?.id || '',
              isEditingMeterName: false,
              originalMeterName: '',

              street: address?.street || '',
              houseNumber: address?.houseNumber || '',
              zip: address?.zip || '',
              city: address?.city || '',

              invoiceRequests: item.invoiceRequests,
              discountRequests: item.discountRequests,

              reportMeterReadings: item.reportMeterReadings,
              supplierMessage: item.order.supplierMessage,
              requestcancellation: item.requestcancellation,

              signedFileUrl: item.order?.doc?.signedFileUrl
                ? `${API_BASE}/assets/customers/${item.order.doc.signedFileUrl}`
                : null,

              address: {
                name: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim(),

                street: `${address?.street || ''} ${address?.houseNumber || ''}`,

                city: `${address?.zip || ''} ${address?.city || ''}`,
              },

              billingAddressData: {
                zip: item?.billingAddress?.zip || '',
                city: item?.billingAddress?.city || '',
                street: item?.billingAddress?.street || '',
                houseNumber: item?.billingAddress?.houseNumber || '',
              },

              deliveryAddressData: {
                zip: item?.customerAddress?.zip || '',
                city: item?.customerAddress?.city || '',
                street: item?.customerAddress?.street || '',
                houseNumber: item?.customerAddress?.houseNumber || '',
              },

              emailData: {
                email: item?.email || '',
              },

              bankData: {
                iban: item?.payment?.iban || '',
                firstName: item?.payment?.firstName || '',
                lastName: item?.payment?.lastName || '',
              },

              personTitle: item?.title || customer?.title || '',
              personFirstName: item?.firstName || '',
              personLastName: item?.lastName || '',
              personSalutation: customer?.salutation || '',
              personCompanyName: customer?.companyName || '',
              personDob: item?.dob ? new Date(item.dob * 1000).toISOString().split('T')[0] : '',
              personNumber: item?.mobile || '',
            };
          });

        console.log('electricityList', this.electricityList);

        this.meterList = res.delivery
          .filter((item: any) => item?.order?.orderId) // only valid contracts
          .map((item: any) => {
            const provider = item?.provider;
            const connection = item?.connection;
            const address = item?.customerAddress;
            const customer = item?.customer;

            return {
              type: provider?.branch === 'gas' ? 'gas' : 'electricity',

              status: item?.order?.orderId
                ? provider?.branch === 'gas'
                  ? 'In Belieferung'
                  : 'Auftrag eingegangen'
                : 'In Bearbeitung',

              meterIcon:
                provider?.branch === 'gas'
                  ? 'assets/icons/gas-meter.png'
                  : 'assets/icons/electric-meter.png',

              providerIcon:
                provider?.branch === 'gas'
                  ? 'assets/icons/1a9ebeaf-78b8-48a3-9514-94f57aa1de2c_Gasvergleich.png'
                  : 'assets/icons/65bd2fa8-bd0e-497e-a781-a3c434fe6176_Stromvergleich.png',

              providerType: provider?.branch === 'gas' ? 'Gas' : 'Strom | Hausstrom',

              meterNumber: connection?.meterNumber || 'N/A',

              marketLocation: connection?.marketLocationId || 'N/A',

              meterName: connection?.meterDesignation || connection?.meterNumber || 'N/A',
              meterDesignation: connection?.meterDesignation || connection?.meterNumber || 'N/A',

              id: connection?.id || '',
              isEditingMeterName: false,
              originalMeterName: '',

              street: address?.street || '',
              houseNumber: address?.houseNumber || '',
              zip: address?.zip || '',
              city: address?.city || '',

              address: {
                name: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim(),
                street: `${address?.street || ''} ${address?.houseNumber || ''}`,
                city: `${address?.zip || ''} ${address?.city || ''}`,
              },

              provider: provider?.providerName || '',
              tariff: provider?.rateName || '',

              contractStart: connection?.desiredDelivery
                ? new Date(connection.desiredDelivery * 1000).toLocaleDateString('de-DE')
                : 'N/A',

              contractEnd: 'N/A', // not provided in API

              contractNumber: item?.uniqueDeliveryId || '',
              customerNumber: connection?.customerNumber || 'N/A',
            };
          });

        this.cdr.detectChanges();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('API Error:', err);
        this.cards = [];
        this.isLoading = false;
      },
    });
  }

  normalizeIcon(icon: string): string {
    if (!icon) return 'meter';

    icon = icon.toLowerCase();

    if (icon.includes('meter')) return 'meter';
    if (icon.includes('home')) return 'home';
    if (icon.includes('current') || icon.includes('electric')) return 'current';
    if (icon.includes('doc')) return 'doc';

    return 'meter';
  }

  @ViewChild('scrollContainer', { static: false })
  scrollContainer!: ElementRef;

  scrollLeft() {
    this.scrollContainer.nativeElement.scrollBy({
      left: -330,
      behavior: 'smooth',
    });
  }

  scrollRight() {
    this.scrollContainer.nativeElement.scrollBy({
      left: 330,
      behavior: 'smooth',
    });
  }

  /*── Service Section End ──*/

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/

  /*── Power of Attorney Section Start ──*/
  /* ── Signature ─── */

  legalFirstName: string = '';
  legalLastName: string = '';
  placeAndDate: string = '';
  recordIsPresent: boolean = false;
  approvalStatus: string = '';
  attorneyCreatedOn: string = '';
  isRevoked: boolean = false;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  signaturePad!: SignaturePad;

  initSignature() {
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')!.scale(ratio, ratio);

    this.signaturePad = new SignaturePad(canvas);
  }

  clear() {
    this.signaturePad.clear();
  }

  attorneyMailSend() {
    const customerId = this.authService.getUserId() || 0;
    const payload = { id: customerId, adminId: 1 };

    this.http.post<any>(`${API_BASE}/customer/send-attorny-mail`, payload).subscribe({
      next: ({ res }) => {
        if (res) {
          this.nextStep(2);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Check Attorney API Error:', err);
      },
    });
  }

  checkAttorneyStatus() {
    const customerId = this.authService.getUserId() || 0;
    const payload = { id: customerId };

    this.http.post<any>(`${API_BASE}/customer/check-attorny`, payload).subscribe({
      next: ({ res, recordIsPresent, approvalStatus, createdOn, isRevoked }) => {
        if (res) {
          this.recordIsPresent = recordIsPresent;
          this.approvalStatus = approvalStatus;
          this.attorneyCreatedOn = this.formatAttorneyDate(createdOn);
          this.isRevoked = isRevoked;

          if (this.activeTab === 4 && this.approvalStatus === 'PENDING' && this.recordIsPresent) {
            this.nextStep(3);
          }

          this.cdr.detectChanges();
          // console.log('Attorney:', this.recordIsPresent);
          // console.log('Status:', this.approvalStatus);
        }
      },
      error: (err) => {
        console.error('Check Attorney API Error:', err);
      },
    });
  }

  formatAttorneyDate(dateValue: any): string {
    if (!dateValue) return '';

    const date = new Date(Number(dateValue) * 1000);

    const formatter = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value;

    return `${get('day')}.${get('month')}.${get('year')} um ${get('hour')}:${get('minute')} Uhr (MEZ)`;
  }

  revoke() {
    const customerId = this.authService.getUserId();

    if (!customerId) return;

    const payload = {
      id: customerId,
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/revoke-attorny`, payload).subscribe({
      next: ({ res, message }) => {
        this.isLoading = false;

        if (res) {
          // console.log('Success:', message);
          this.isRevoked = true;
          this.nextStep(1);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
      },
    });
  }

  getSignatureFile(): File {
    const canvas = this.canvasRef.nativeElement;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    const ctx = tempCanvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    ctx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');

    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new File([ab], 'signature.png', { type: mimeString });
  }

  submitAttorney() {
    this.fieldErrors = {};

    let valid = true;

    if (this.customerType === 'BUSINESS') {
      if (!this.legalFirstName?.trim()) {
        this.fieldErrors['legalFirstName'] = 'Vorname erforderlich';
        valid = false;
      }

      if (!this.legalLastName?.trim()) {
        this.fieldErrors['legalLastName'] = 'Nachname erforderlich';
        valid = false;
      }
    }

    if (!this.placeAndDate?.trim()) {
      this.fieldErrors['placeAndDate'] = 'Ort und Datum erforderlich';
      valid = false;
    }

    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      this.fieldErrors['signature'] = 'Unterschrift erforderlich';
      valid = false;
    }

    if (!valid) return;
    const customerId = this.authService.getUserId() || 0;

    const payload = {
      adminId: 1,
      customerId: customerId,
      salutation: this.customerData.salutation,
      title: this.customerData.title,
      userType: this.customerType,
      firstName: this.customerData.firstName,
      lastName: this.customerData.lastName,
      zip: this.customerData.address?.zip,
      city: this.customerData.address?.city,
      street: this.customerData.address?.street,
      houseNumber: this.customerData.address?.houseNumber,
      placeAndDate: this.placeAndDate,
      companyName: this.customerData.companyName,
      legalRepresentativeFirstName: this.legalFirstName,
      legalRepresentativeLastName: this.legalLastName,
    };

    const formData = new FormData();

    formData.append('data', JSON.stringify(payload));

    const file = this.getSignatureFile();
    formData.append('file', file);

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/add-attorny`, formData).subscribe({
      next: ({ res, message, createdOn, errMessage }) => {
        this.isLoading = false;

        if (res) {
          // console.log('Success:', message);
          // console.log('Created On:', createdOn);
          this.placeAndDate = '';
          this.legalFirstName = '';
          this.legalLastName = '';
          this.approvalStatus = 'PENDING';
          this.recordIsPresent = true;
          this.attorneyCreatedOn = this.formatAttorneyDate(createdOn);
          this.signaturePad.clear();
          this.nextStep(3);
        } else {
          this.isLoading = false;
          this.apiError = errMessage;
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
        this.cdr.detectChanges();
      },
    });
  }

  createQRData() {
    const user = {
      user_id: this.authService.getUserId() || 0,
      flag: 'CUSTOMER_ONLY',
    };

    const json = JSON.stringify(user);

    // encode
    const encoded = btoa(json);

    return `http://localhost:4200/customer?data=${encoded}`;
  }

  /*── Power of Attorney Section End ──*/

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /* ──  Document Section Start ──*/
  // orderDocuments = [
  //   {
  //     logo: 'assets/icons/Icons_energyprovider/eon.png',
  //     title: 'E.ON ÖkoStrom Extra 12',
  //     workPrice: '26,80',
  //     basePrice: '14,90',
  //     contractNumber: '0215/123456789',
  //     monthly: '68,40',
  //   },
  //   {
  //     logo: 'assets/icons/Icons_energyprovider/vattenfall.png',
  //     title: 'Strom XXL Extra 12',
  //     workPrice: '11,72',
  //     basePrice: '21,90',
  //     contractNumber: '012455-64564564k1245',
  //     monthly: '151,40',
  //   },
  // ];

  orderDocuments: any[] = [];
  isOrderDocumentsLoading: boolean = false;
  noOrderDocumentsFound: boolean = false;

  attorneyDocuments = [
    {
      title: 'Beratervollmacht',
      subtitle: 'für Privatkunden',
      createdOn: 'Erstellt am 30.03.2026 umd 18:26 Uhr (MEZ)',
    },
    {
      title: '360° Beraterservice',
      subtitle: 'Beraterservicevollmacht für Privatkunden',
      createdOn: 'Erteilt am 09.04.2026 umd 17:04 Uhr (MEZ)',
    },
  ];

  cancelDocuments = [
    {
      logo: 'assets/icons/Icons_energyprovider/GruenWelt.png',
      title: 'Grünwelt ÖkoStrom 12',
      contractNumber: '0125/1789454784654',
      terminatedOn: '09.01.2026',
    },
  ];

  contractDocuments = [
    {
      logo: 'assets/icons/Icons_energyprovider/eon.png',
      title: 'E.ON ÖkoStrom Extra 12',
      workPrice: '26,80',
      basePrice: '14,90',
      contractNumber: '0215/123456789',
      monthly: '68,40',
    },
    {
      logo: 'assets/icons/Icons_energyprovider/vattenfall.png',
      title: 'Strom XXL Extra 12',
      workPrice: '11,72',
      basePrice: '21,90',
      contractNumber: '012455-64564564k1245',
      monthly: '151,40',
    },
  ];

  miscellaneousDocuments = [
    {
      title: 'Datenschutzbestimmungen',
      subtitle: 'für Privatkunden',
      createdOn: 'Erstellt am 30.03.2026 umd 18:26 Uhr (MEZ)',
      viewBtn: 'Bestimmungen ansehen',
      downloadBtn: 'Bestimmungen downloaden',
    },
    {
      title: 'Widerrufsbelehrung',
      subtitle: 'Beraterservicevollmacht für Privatkunden',
      createdOn: 'Erstellt am 09.04.2026 umd 17:04 Uhr (MEZ)',
      viewBtn: 'Belehrung ansehen ',
      downloadBtn: 'Vollmacht downloaden',
    },
  ];

  toggleDocument(step: number) {
    this.documentTab = step;

    // Trigger API call when Auftragsdokumente is clicked
    if (step === 1) {
      this.fetchOrderDocuments();
    }
  }

  fetchOrderDocuments() {
    const customerId = this.authService.getUserId() || 0;
    const payload = { id: customerId, adminId: 1 };

    this.isOrderDocumentsLoading = true;
    this.noOrderDocumentsFound = false;

    this.http.post<any>(`${API_BASE}/customer/fetch-placed-deliveries`, payload).subscribe({
      next: (res) => {
        this.isOrderDocumentsLoading = false;

        // Use res.delivery instead of res.data
        if (res && res.delivery && Array.isArray(res.delivery) && res.delivery.length > 0) {
          this.orderDocuments = res.delivery
            // Check if order exists and if doc is present
            .filter((item: any) => item.order && item.order.doc)
            .map((item: any) => {
              const provider = item.provider || {};
              const order = item.order || {};

              return {
                id: item.deliveryId, // Using deliveryId as a unique identifier
                logo: provider.providerSVG || 'assets/icons/default.png',
                title: provider.rateName || 'N/A',
                workPrice: provider.workPrice || '0,00',
                basePrice: provider.basePrice || '0,00',
                contractNumber: item.uniqueDeliveryId || 'N/A',
                monthly: provider.totalPriceMonth || '0,00', // Mapped from totalPriceMonth based on your JSON
                orderData: order, // Save order object for button actions
              };
            });

          // Show 'no order data found' if list is empty after filtering
          if (this.orderDocuments.length === 0) {
            this.noOrderDocumentsFound = true;
          }
        } else {
          this.orderDocuments = [];
          this.noOrderDocumentsFound = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('API Error:', err);
        this.isOrderDocumentsLoading = false;
        this.noOrderDocumentsFound = true;
        this.cdr.detectChanges();
      },
    });
  }

  viewOrderDetails(doc: any) {
    if (doc.orderData?.doc?.signedFileUrl) {
      // Insert /assets/customers/ before the signedFileUrl
      const fileUrl = `${API_BASE}/assets/customers/${doc.orderData.doc.signedFileUrl}`;
      window.open(fileUrl, '_blank');
    } else {
      console.log('No document URL found');
    }
  }

  downloadOrderDocument(doc: any) {
    if (doc.orderData?.doc?.signedFileUrl) {
      // Insert /assets/customers/ before the signedFileUrl
      const fileUrl = `${API_BASE}/assets/customers/${doc.orderData.doc.signedFileUrl}`;
      window.open(fileUrl, '_blank');
    } else {
      console.log('No document URL found');
    }
  }

  viewDocument() {
    const pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    window.open(pdfUrl, '_blank');
  }

  viewPdf(url?: string) {
    if (url && url.startsWith('data:application/pdf;base64,')) {
      const base64Data = url.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else if (url) {
      window.open(url, '_blank');
    } else {
      this.viewDocument();
    }
  }

  downloadPdf(url?: string) {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Vollmacht.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      this.downloadDocument();
    }
  }

  downloadDocument() {
    const customerId = this.authService.getUserId();

    if (!customerId) return;

    const payload = {
      id: customerId,
      adminId: 1,
    };

    this.isLoading = true;

    this.http.post<any>(`${API_BASE}/customer/fetch-customer-details`, payload).subscribe({
      next: ({ res, message }) => {
        this.isLoading = false;

        if (res) {
          // console.log('Success:', message);

          this.nextStep(2);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('API Error:', err);
      },
    });
  }
  /*── Document Section End ──*/

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /* ──  Reset Password Section Start ──*/
  /* ══════════════════════════════════════════════════════════════════
  STEP 1 — Password VALIDATION
  ══════════════════════════════════════════════════════════════════ */

  /* ── Password validation flags ──────────────────────────────────── */
  pw_length: boolean = false;
  pw_case: boolean = false;
  pw_special: boolean = false;
  pw_number: boolean = false;
  showPw: boolean = false;
  showOldPw: boolean = false;
  showRepPw: boolean = false;
  otpError: string = '';
  newPassword: string = '';
  oldPassword: string = '';
  confirmPassword: string = '';
  passwordMismatch: boolean = false;
  otpValue: string = '';
  otpInvalid = false;
  newOtp = false;
  isLoadingReset: boolean = false;
  apiError: string = '';
  resendSuccess: boolean = false;

  clearPwdField() {
    this.newPassword = '';
    this.oldPassword = '';
    this.confirmPassword = '';
    this.showPw = false;
    this.showOldPw = false;
    this.showRepPw = false;
    this.otpError = '';
    this.passwordMismatch = false;
  }

  validatePassword(password: string, repeat: string) {
    this.newPassword = password;

    this.pw_length = password.length >= 8 && password.length <= 50;
    this.pw_case = /[a-z]/.test(password) && /[A-Z]/.test(password);
    this.pw_special = /[!@\$%\^&\*\+#]/.test(password);
    this.pw_number = /[0-9]/.test(password);

    if (repeat.length > 0) {
      this.passwordMismatch = password !== repeat;
    } else {
      this.passwordMismatch = false;
    }
  }

  private isPasswordValid(): boolean {
    return this.pw_length && this.pw_case && this.pw_special && this.pw_number;
  }

  private validateStepReset(passwordRepeat: string): boolean {
    this.fieldErrors = {};
    let valid = true;

    if (!this.oldPassword) {
      this.fieldErrors['oldPassword'] = 'Ein altes Passwort wird benötigt.';
      valid = false;
    } else if (!this.isPasswordValid()) {
      this.fieldErrors['oldPassword'] = 'Passwort erfüllt nicht alle Anforderungen.';
      valid = false;
    }

    if (!this.newPassword) {
      this.fieldErrors['newPassword'] = 'Ein neues Passwort ist erforderlich.';
      valid = false;
    } else if (!this.isPasswordValid()) {
      this.fieldErrors['newPassword'] = 'Passwort erfüllt nicht alle Anforderungen.';
      valid = false;
    }

    if (this.newPassword !== passwordRepeat) {
      this.passwordMismatch = true;
      valid = false;
    }
    return valid;
  }
  successMessage: string = '';

  forgotOldPwd() {
    this.http
      .post<any>(`${API_BASE}/auth/forgot-old-password`, {
        id: Number(this.authService.getUserId()),
        adminId: 1,
      })
      .subscribe({
        next: (res) => {
          // console.log(res);

          if (res) {
            this.successMessage =
              'Eine E-Mail wurde an Ihre E-Mail-Adresse gesendet. Bitte prüfen Sie Ihr Postfach.';

            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          this.apiError =
            err?.error?.message || 'Fehler beim Zurücksetzen. Bitte erneut versuchen.';
        },
      });
  }
  resetPassword() {
    // console.log('resetPassword called');
    this.apiError = '';

    const isValid = this.validateStepReset(this.confirmPassword);

    if (!isValid) {
      // console.log('not valid');
      return;
    }

    if (!this.authService.getUserId()) {
      this.apiError = 'Session abgelaufen.';
      // console.log('Session abgelaufen.');
      return;
    }

    this.isLoadingReset = true;

    this.http
      .post<{
        res: boolean;
        message: string;
        errMessage: string;
      }>(`${API_BASE}/auth/change-password-request`, {
        id: Number(this.authService.getUserId()),
        oldPassword: this.oldPassword,
        newPassword: this.newPassword,
        confirmPassword: this.confirmPassword,
        adminId: 1,
      })
      .subscribe({
        next: (res) => {
          this.isLoadingReset = false;

          if (res.res) {
            this.currentStep = 2;
            this.clearPwdField();
          } else {
            // console.log('false going');
            // console.log('error message', res.errMessage);

            this.apiError = res.errMessage || 'Error occurred';
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoadingReset = false;
          this.apiError =
            err?.error?.message || 'Fehler beim Zurücksetzen. Bitte erneut versuchen.';
        },
      });
  }

  @ViewChild('countdown', { static: false }) private readonly countdown!: CountdownComponent;

  config: CountdownConfig = {
    leftTime: environment.resendTimer,
    format: 'm:ss',
    demand: false,
  };

  isResendDisabled: boolean = true;

  handleEvent(event: CountdownEvent) {
    if (event.action === 'done') {
      this.isResendDisabled = false;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
  STEP 2 — OTP INPUT HELPERS
  ══════════════════════════════════════════════════════════════════ */

  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    this.collectOtp();
    this.otpError = '';

    if (val && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (next) next.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      const input = event.target as HTMLInputElement;
      if (!input.value && index > 0) {
        const prev = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
        if (prev) {
          prev.value = '';
          prev.focus();
        }
      }
      this.collectOtp();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    pasted.split('').forEach((ch, i) => {
      const el = document.getElementById(`otp-${i}`) as HTMLInputElement;
      if (el) el.value = ch;
    });
    this.collectOtp();
    const last = document.getElementById(
      `otp-${Math.min(pasted.length - 1, 5)}`,
    ) as HTMLInputElement;
    if (last) last.focus();
  }

  private collectOtp() {
    let val = '';
    for (let i = 0; i < 6; i++) {
      const el = document.getElementById(`otp-${i}`) as HTMLInputElement;
      val += el ? el.value || '' : '';
    }
    this.otpValue = val;
  }

  verifyOtp() {
    this.collectOtp();
    if (this.otpValue.length < 6) {
      this.otpError = 'Bitte alle 6 Stellen eingeben.';
      return;
    }
    if (!this.authService.getUserId()) {
      this.otpError = 'Sitzung abgelaufen. Bitte neu registrieren.';
      return;
    }

    this.isLoading = true;
    this.otpError = '';

    this.http
      .post<{
        res: boolean;
        newOtp?: boolean;
        message: string;
      }>(`${API_BASE}/auth/verify-change-password`, {
        id: this.authService.getUserId(),
        otp: this.otpValue,
        adminId: 1,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.res) {
            this.otpInvalid = false;

            this.nextStep(3);
            this.cdr.detectChanges();
          } else {
            this.otpError = 'Der eingegebene Code ist ungültig.';
            this.otpInvalid = true;
          }
          this.newOtp = !!res.newOtp;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoading = false;
          this.otpError =
            err?.error?.message || 'Code-Überprüfung fehlgeschlagen. Bitte erneut versuchen.';
        },
      });
  }

  resendOtp() {
    if (!this.authService.getUserId()) return;
    if (this.isResendDisabled) return;
    this.isResendDisabled = true;

    setTimeout(() => {
      this.countdown?.restart();
    });
    this.resendSuccess = false;
    this.otpError = '';

    this.http
      .post<{
        res: boolean;
        message: string;
      }>(`${API_BASE}/auth/resend-otp`, { id: this.authService.getUserId() })
      .subscribe({
        next: (res) => {
          this.resendSuccess = true;
          // Clear boxes
          for (let i = 0; i < 6; i++) {
            const el = document.getElementById(`otp-${i}`) as HTMLInputElement;
            if (el) el.value = '';
          }
          this.otpValue = '';

          setTimeout(() => (this.resendSuccess = false), 4000);
        },
        error: () => {
          this.otpError = 'Code konnte nicht gesendet werden. Bitte erneut versuchen.';
        },
      });
  }
  /* ──  Reset Password Section End ──*/
  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /* ──  Profile Information Section Start ──*/

  /* ──  Profile Information Section Start ──*/
  viewSection: number = 0;
  selectMyCounter() {
    this.setActiveTab(1);
    this.viewSection = 1;
    this.cdr.detectChanges();
  }
  selectMyContracts() {
    this.setActiveTab(1);
    this.viewSection = 2;
    this.cdr.detectChanges();
  }
  contactFieldErrors: Record<string, string> = {};
  addressFieldErrors: Record<string, string> = {};
  validateContactForm(): boolean {
    this.contactFieldErrors = {};

    const errors: any = {};
    if (!this.customerData.salutation?.trim()) {
      errors['salutation'] = 'Bitte Anrede auswählen';
    }

    if (!this.customerData.firstName?.trim()) {
      errors['firstName'] = 'Vorname ist erforderlich';
    }

    if (!this.customerData.lastName?.trim()) {
      errors['lastName'] = 'Nachname ist erforderlich';
    }

    if (this.customerType === 'BUSINESS' && !this.customerData.companyName?.trim()) {
      errors['companyName'] = 'Firmenname ist erforderlich';
    }

    const mobile = (this.customerData.phoneNumber || '').replace(/\s/g, '');

    if (!mobile) {
      errors['mobileNumber'] = 'Handynummer ist erforderlich.';
    }

    this.contactFieldErrors = errors;

    return Object.keys(this.contactFieldErrors).length === 0;
  }

  saveContactData(): void {
    if (!this.validateContactForm()) return;
    const customerId = this.authService.getUserId() || 0;
    const body = {
      id: Number(customerId),
      salutation: this.customerData.salutation,
      title: this.customerData.title,
      firstName: this.customerData.firstName,
      lastName: this.customerData.lastName,
      companyName: this.customerData.companyName,
      mobileNumber: this.customerData.phoneNumber,
      telephone: this.customerData.telephone,
      adminId: 1,
    };

    this.http.post<any>(`${API_BASE}/customer/update-customer-detail`, body).subscribe({
      next: (res) => {
        if (res?.res) {
          this.customerData.name =
            `${this.customerData.firstName} ${this.customerData.lastName}`.trim();
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('saveContactData error:', err),
    });
  }

  validateAddressForm(): boolean {
    this.addressFieldErrors = {};

    if (!this.customerData.salutation?.trim()) {
      this.addressFieldErrors['salutation'] = 'Bitte Anrede auswählen';
    }

    if (!this.customerData.firstName?.trim()) {
      this.addressFieldErrors['firstName'] = 'Vorname ist erforderlich';
    }

    if (!this.customerData.lastName?.trim()) {
      this.addressFieldErrors['lastName'] = 'Nachname ist erforderlich';
    }

    if (!this.customerData.address?.zip?.trim()) {
      this.addressFieldErrors['zip'] = 'PLZ ist erforderlich';
    }

    if (!this.customerData.address?.city?.trim()) {
      this.addressFieldErrors['city'] = 'Ort ist erforderlich';
    }

    if (!this.customerData.address?.street?.trim()) {
      this.addressFieldErrors['street'] = 'Straße ist erforderlich';
    }

    if (!this.customerData.address?.houseNumber?.trim()) {
      this.addressFieldErrors['houseNumber'] = 'Hausnummer ist erforderlich';
    }

    return Object.keys(this.addressFieldErrors).length === 0;
  }

  saveAddressData(): void {
    if (!this.validateAddressForm()) return;
    const customerId = this.authService.getUserId() || 0;
    const body = {
      id: Number(customerId),
      salutation: this.customerData.salutation,
      title: this.customerData.title,
      firstName: this.customerData.firstName,
      lastName: this.customerData.lastName,
      zip: this.customerData.address.zip,
      city: this.customerData.address.city,
      street: this.customerData.address.street,
      houseNumber: this.customerData.address.houseNumber,
      adminId: 1,
    };

    this.http.post<any>(`${API_BASE}/customer/update-customer-detail`, body).subscribe({
      next: (res) => {
        this.successMessage = 'Adressdaten erfolgreich gespeichert.';

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);

        const data = {
          zip: this.customerData.address.zip,
          city: this.customerData.address.city,
          street: this.customerData.address.street,
          houseNumber: this.customerData.address.houseNumber,
        };

        this.authService.setAddressData(data);

        this.cdr.detectChanges();
      },
      error: (err) => console.error('saveAddressData error:', err),
    });
  }

  saveMeterData(): void {
    const customerId = this.authService.getUserId() || 0;
    const body = {
      id: Number(customerId),
      meters: this.customerData.standardMeters,
    };

    this.http.post<any>(`${API_BASE}/customer/update-meters`, body).subscribe({
      next: (res) => {
        this.cdr.detectChanges();
      },
      error: (err) => console.error('saveMeterData error:', err),
    });
  }

  editBankAccount(account: any): void {
    // Navigate to edit view or open a modal — adjust to your routing pattern
    // console.log('editBankAccount:', account);
  }

  changeBankAccount(account: any): void {
    // Trigger payment-method change flow — adjust to your routing pattern
    // console.log('changeBankAccount:', account);
  }

  // =========================
  // EDIT ADDRESS VARIABLES
  // =========================

  editCityOptions: { city: string; city_id: string }[] = [];
  editStreetOptions: { street: string; street_id: string }[] = [];

  editFilteredCityOptions: any[] = [];
  editFilteredStreetOptions: any[] = [];

  editCitySearch = '';
  editStreetSearch = '';

  showEditCityDropdown = false;
  showEditStreetDropdown = false;

  isEditStreetLoading = false;

  // =========================
  // POSTAL CODE INPUT
  // =========================

  onEditPostalCodeInput(event: any) {
    const value = event.target.value;

    this.customerData.address.zip = value;

    if (!/^\d{5}$/.test(value)) {
      this.resetEditCity();
      this.resetEditStreet();
      return;
    }

    this.addressService.getCitiesByZip(value).subscribe((cities: any[]) => {
      this.editCityOptions = cities;
      this.editFilteredCityOptions = cities;

      if (cities.length === 1) {
        const city = cities[0];

        this.editCitySearch = city.city;

        this.customerData.address.city = city.city;

        this.showEditCityDropdown = false;

        this.loadEditStreetData();

        this.cdr.detectChanges();
      }
    });
  }

  // =========================
  // CITY INPUT
  // =========================

  onEditCityInput(event: any) {
    const value = event.target.value.toLowerCase();

    this.editCitySearch = event.target.value;

    this.editFilteredCityOptions = this.editCityOptions.filter((c) =>
      c.city.toLowerCase().includes(value),
    );

    this.showEditCityDropdown = true;
  }

  // =========================
  // SELECT CITY
  // =========================

  selectEditCity(city: any) {
    this.editCitySearch = city.city;

    this.customerData.address.city = city.city;

    this.showEditCityDropdown = false;

    this.resetEditStreet();

    this.loadEditStreetData();
  }

  // =========================
  // LOAD STREETS
  // =========================

  loadEditStreetData() {
    if (!this.customerData.address.zip || !this.customerData.address.city) {
      return;
    }

    this.isEditStreetLoading = true;

    this.addressService
      .getStreetsByCity(this.customerData.address.zip, this.customerData.address.city)
      .subscribe((streets: any[]) => {
        this.editStreetOptions = streets;

        this.editFilteredStreetOptions = streets;

        this.isEditStreetLoading = false;

        this.showEditStreetDropdown = true;

        this.cdr.detectChanges();
      });
  }

  // =========================
  // STREET INPUT
  // =========================

  onEditStreetInput(event: any) {
    const value = event.target.value.toLowerCase();

    this.editStreetSearch = event.target.value;

    this.editFilteredStreetOptions = this.editStreetOptions.filter((s) =>
      (s.street ?? '').toLowerCase().includes(value),
    );

    this.showEditStreetDropdown = true;
  }

  // =========================
  // SELECT STREET
  // =========================

  selectEditStreet(street: any) {
    this.editStreetSearch = street.street;

    this.customerData.address.street = street.street;

    this.showEditStreetDropdown = false;
  }

  // =========================
  // RESET
  // =========================

  resetEditCity() {
    this.editCitySearch = '';

    this.customerData.address.city = '';

    this.editCityOptions = [];

    this.editFilteredCityOptions = [];
  }

  resetEditStreet() {
    this.editStreetSearch = '';

    this.customerData.address.street = '';

    this.editStreetOptions = [];

    this.editFilteredStreetOptions = [];
  }

  /* ──  Profile Information Section End ──*/

  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
  /* ──  Sub-Account Section Start ──*/

  subAccounts: any[] = [];
  showInviteForm: boolean = false;
  newSubAccountEmail: string = '';
  subAccountSuccessMessage: string = '';
  subAccountErrors: { [key: string]: string } = {};

  sendSubAccountInvitation() {
    this.subAccountErrors = {};

    // Basic Email Validation
    if (!this.newSubAccountEmail || !this.newSubAccountEmail.includes('@')) {
      this.subAccountErrors['email'] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      return;
    }

    // Handle your API invitation logic here
    console.log('Sending invitation to:', this.newSubAccountEmail);

    // Mocking API Success response:
    this.subAccountSuccessMessage = 'Die Einladung wurde erfolgreich gesendet.';
    this.showInviteForm = false;
    this.newSubAccountEmail = '';

    // Clear success message after a few seconds
    setTimeout(() => (this.subAccountSuccessMessage = ''), 5000);
  }

  cancelInvitation() {
    this.showInviteForm = false;
    this.newSubAccountEmail = '';
    this.subAccountErrors = {};
  }

  removeSubAccount(id: number) {
    // Logic to handle deleting/revoking a sub-account access
    console.log('Removing account ID:', id);
  }

  /* ──  Sub-Account Section End ──*/
  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/

  /* ──  Profile Information Section Start ──*/
  /* ════════════════════════════════════════════════════════════════════════════════════════════════*/
}
