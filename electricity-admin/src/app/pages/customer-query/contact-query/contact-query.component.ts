import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  debounceTime,
  distinctUntilChanged,
  Subject,
  Subscription,
} from "rxjs";
import { ApiService } from "../../../shared/services/api.service";
import { AuthService } from "../../../shared/services/auth.service";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";

// ── Types ────────────────────────────────────────────────────────

export type Customer = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
  title: string;
  salutation: string;
};

export type ContactQuery = {
  customerQueryContactId: number;
  salutation: string;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  inquiry: string;
  createdOn: number;
  isResolved: boolean;
  resolvedOn: number | null;
  categoryName: string;
  CategoryId: number;
  customer: Customer | null;
  customers?: Customer[];
};

@Component({
  selector: "app-contact-query",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./contact-query.component.html",
  styleUrl: "./contact-query.component.css",
})
export class ContactQueryComponent implements OnInit, OnDestroy {
  @ViewChild("searchInput") searchInputRef!: ElementRef<HTMLInputElement>;

  queries: ContactQuery[] = [];
  isLoading = false;
  errorMessage = "";
  selectedEntry: ContactQuery | null = null;
  isSidebarOpen = false;

  // ── Pagination ───────────────────────────────────────────────
  hasMoreData = true;
  currentPage = 1;
  totalCount = 0;
  totalPages = 1;
  private readonly PAGE_LIMIT = 10;

  // ── Search ───────────────────────────────────────────────────
  searchTerm = "";
  private searchTerm$ = new Subject<string>();
  private searchSub!: Subscription;

  // ── Link Customer Modal ──────────────────────────────────────
  isModalOpen = false;
  modalEntry: ContactQuery | null = null;

  // Multi-select: list of chosen customers
  selectedCustomers: Customer[] = [];

  // Search inside modal
  customerSearchTerm = "";
  customerSearchResults: Customer[] = [];
  isSearchingCustomers = false;
  isDropdownOpen = false;

  isLinking = false;
  linkSuccessMessage = "";
  linkErrorMessage = "";

  // View Linked Users Modal
  isViewLinkedModalOpen = false;
  viewLinkedEntry: ContactQuery | null = null;

  private customerSearch$ = new Subject<string>();
  private customerSearchSub!: Subscription;

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchTerm$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.fetchQueries(1);
      });

    this.customerSearchSub = this.customerSearch$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe((term) => this.searchCustomers(term));

    this.fetchQueries();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.customerSearchSub?.unsubscribe();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchTerm$.next(value);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.searchTerm$.next("");
  }

  // ── Data fetching ─────────────────────────────────────────────

  fetchQueries(page: number = 1): void {
    this.currentPage = page;
    const searchTerms = this.searchTerm.trim();

    const payload = {
      adminId: this.authService.getUserId(),
      page: this.currentPage,
      limit: this.PAGE_LIMIT,
      search: searchTerms || undefined,
    };
    this.isLoading = true;
    this.errorMessage = "";
    this.closeSidebar();

    this.api.post("fetch-customer-queries", payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const newData = this.extractList(res);
        this.queries = newData;
        this.hasMoreData = newData.length === this.PAGE_LIMIT;

        const total =
          res?.total ??
          res?.data?.total ??
          res?.totalElements ??
          res?.data?.totalElements ??
          res?.totalRecords ??
          res?.data?.totalRecords ??
          res?.count ??
          res?.data?.count;

        if (typeof total === "number") {
          this.totalCount = total;
        } else {
          this.totalCount = this.hasMoreData
            ? this.currentPage * this.PAGE_LIMIT + 1
            : (this.currentPage - 1) * this.PAGE_LIMIT + newData.length;
        }
        this.totalPages = Math.max(
          1,
          Math.ceil(this.totalCount / this.PAGE_LIMIT),
        );
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = "Fehler beim Laden der Kontaktanfragen.";
        console.error("Kontaktanfragen fetch error:", err);
      },
    });
  }

  nextPage(): void {
    if (this.hasMoreData && this.currentPage < this.totalPages) {
      this.fetchQueries(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) this.fetchQueries(this.currentPage - 1);
  }

  toggleQueryStatus(entry: ContactQuery, event: Event): void {
    event.stopPropagation();

    const newStatus = !entry.isResolved;

    const payload = {
      queryId: entry.customerQueryContactId,
      isResolved: newStatus,
    };

    this.api.post("toggle-contact-query-status", payload).subscribe({
      next: (res: any) => {
        if (res?.res) {
          entry.isResolved = newStatus;

          if (newStatus) {
            entry.resolvedOn = Date.now();
          } else {
            entry.resolvedOn = null;
          }
        }
      },

      error: (err) => {
        console.error("Failed to update query status", err);
      },
    });
  }

  get pageRangeFrom(): number {
    return (this.currentPage - 1) * this.PAGE_LIMIT + 1;
  }

  get pageRangeTo(): number {
    return Math.min(this.currentPage * this.PAGE_LIMIT, this.totalCount);
  }

  // Multiple Search Selection
  onSearchSelect(customer: Customer): void {
    this.selectedCustomers = [customer];
    this.isDropdownOpen = false;
    this.customerSearchTerm = "";
    this.customerSearchResults = [];
    setTimeout(() => this.searchInputRef?.nativeElement.blur(), 50);
  }
  // ── Sidebar ───────────────────────────────────────────────────
  selectedIndex: number | null = null;
  openSidebar(entry: ContactQuery, index: number): void {
    if (
      this.selectedEntry?.customerQueryContactId ===
      entry.customerQueryContactId
    ) {
      this.closeSidebar();
      return;
    }
    this.selectedEntry = entry;
    this.selectedIndex = index;
    this.isSidebarOpen = true;
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
    this.selectedIndex = null;
    this.selectedEntry = null;
  }

  isSelected(entry: ContactQuery): boolean {
    return (
      this.selectedEntry?.customerQueryContactId ===
      entry.customerQueryContactId
    );
  }

  // ── Link Customer Modal ───────────────────────────────────────

  openLinkModal(event: Event, entry: ContactQuery, index: number): void {
    event.stopPropagation();
    this.modalEntry = entry;
    this.isModalOpen = true;
    this.selectedCustomers = entry.customer ? [entry.customer] : [];
    this.customerSearchTerm = "";
    this.customerSearchResults = [];
    this.isDropdownOpen = false;
    this.linkSuccessMessage = "";
    this.linkErrorMessage = "";
    this.selectedIndex = index;
    this.searchCustomers("");
  }

  closeLinkModal(): void {
    this.isModalOpen = false;
    this.modalEntry = null;
    this.selectedCustomers = [];
    this.customerSearchTerm = "";
    this.customerSearchResults = [];
    this.isDropdownOpen = false;
    this.linkSuccessMessage = "";
    this.linkErrorMessage = "";
    this.selectedIndex = null;
  }

  // Focus the hidden input when clicking the tag box
  focusSearch(): void {
    this.isDropdownOpen = true;
    this.searchInputRef?.nativeElement.focus();
    if (!this.customerSearchTerm && this.customerSearchResults.length === 0) {
      this.customerSearch$.next("");
    }
  }

  onCustomerSearchFocus(): void {
    this.isDropdownOpen = true;
    if (!this.customerSearchTerm && this.customerSearchResults.length === 0) {
      this.customerSearch$.next("");
    }
  }

  toggleCustomerSearchDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
    }
  }

  clearCustomerSearch(): void {
    this.customerSearchTerm = "";
    this.selectedCustomers = [];
    this.customerSearch$.next("");
  }

  // ── Multi-select helpers ──────────────────────────────────────

  isCustomerSelected(id: number): boolean {
    return this.selectedCustomers.some((c) => c.id === id);
  }

  addCustomer(customer: Customer): void {
    if (!this.isCustomerSelected(customer.id)) {
      this.selectedCustomers = [...this.selectedCustomers, customer];
    }
    this.customerSearchTerm = "";
    this.isDropdownOpen = false;
    this.customerSearch$.next("");
  }

  removeCustomer(id: number): void {
    this.selectedCustomers = this.selectedCustomers.filter((c) => c.id !== id);
  }

  // ── Customer search inside modal ──────────────────────────────

  onCustomerSearchInput(value: string): void {
    this.customerSearchTerm = value;
    this.isDropdownOpen = true;
    this.customerSearch$.next(value);
  }

  onSearchBlur(): void {
    // Delay so click on dropdown item fires first
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 200);
  }

  searchCustomers(term: string): void {
    this.isSearchingCustomers = true;
    const payload = {
      adminId: this.authService.getUserId(),
      search: term.trim(),
      page: 1,
      limit: 10,
    };

    this.api.post("admin/fetch-customer-details", payload).subscribe({
      next: (res: any) => {
        this.isSearchingCustomers = false;
        this.customerSearchResults = this.extractCustomerList(res);
      },
      error: () => {
        this.isSearchingCustomers = false;
        this.customerSearchResults = [];
      },
    });
  }

  // ── Link (submit) ─────────────────────────────────────────────

  linkCustomers(): void {
    if (!this.modalEntry || this.selectedCustomers.length === 0) return;
    this.isLinking = true;
    this.linkSuccessMessage = "";
    this.linkErrorMessage = "";

    const payload = {
      adminId: this.authService.getUserId(),
      customerQueryContactId: this.modalEntry.customerQueryContactId,
      // Send array of customer IDs for multi-select
      customerIds: this.selectedCustomers.map((c) => c.id),
    };

    this.api.post("link-customer-query", payload).subscribe({
      next: () => {
        this.isLinking = false;
        this.linkSuccessMessage = `${this.selectedCustomers.length} Kunde${this.selectedCustomers.length !== 1 ? "n" : ""} erfolgreich verknüpft!`;
        // Update the row locally — store first selected as primary customer
        const idx = this.queries.findIndex(
          (q) =>
            q.customerQueryContactId ===
            this.modalEntry!.customerQueryContactId,
        );
        if (idx !== -1) {
          this.queries[idx] = {
            ...this.queries[idx],
            customer: this.selectedCustomers[0] || null,
            customers: [...this.selectedCustomers],
          };
        }
        setTimeout(() => this.closeLinkModal(), 1500);
      },
      error: (err) => {
        this.isLinking = false;
        this.linkErrorMessage = "Fehler beim Verknüpfen des Kunden.";
        console.error("Link customer error:", err);
      },
    });
  }

  // ── Customer helpers ──────────────────────────────────────────

  isLoggedIn(entry: ContactQuery): boolean {
    return !!entry.customer?.id && entry.customer.id !== 0;
  }

  queryFullName(entry: ContactQuery): string {
    return (
      [entry.title, entry.firstName, entry.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "—"
    );
  }

  queryInitials(entry: ContactQuery): string {
    return entry.customer
      ? (entry.customer.firstName[0] || "") + (entry.customer.lastName[0] || "")
      : (entry.firstName[0] || "") + (entry.lastName[0] || "");
  }

  // ── View Linked Users ─────────────────────────────────────────

  openViewLinkedModal(event: Event, entry: ContactQuery, index: number): void {
    event.stopPropagation();
    this.viewLinkedEntry = entry;
    this.selectedIndex = index;
    this.isViewLinkedModalOpen = true;
  }

  closeViewLinkedModal(): void {
    this.isViewLinkedModalOpen = false;
    this.selectedIndex = null;
    this.viewLinkedEntry = null;
  }

  formatDateTime(value?: number | string | null): string {
    if (value === null || value === undefined || value === "") return "—";
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return String(value);
    const ms = num < 1_000_000_000_000 ? num * 1000 : num;
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  }

  private extractList(response: any): ContactQuery[] {
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private extractCustomerList(response: any): Customer[] {
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }
}
