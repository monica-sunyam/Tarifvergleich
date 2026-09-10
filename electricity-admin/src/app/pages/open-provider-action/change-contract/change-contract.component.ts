import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";

const DOC_BASE_URL =
  "http://192.168.0.155:8080/assets/customers/";

export interface ChangeContract {
  deliveryId?: number;

  createdOn?: number;
  status?: number;
  energyBranch?: string;

  customer?: {
    id?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    userType?: string;
    title?: string;
    salutation?: string;
  };

  selectedOption?: {
    contractEditSelectedOptionId?: number;
    optionName?: string;
  };

  lastName?: string | null;
  companyName?: string | null;
  filePath?: string | null;
  title?: string | null;
  firstName?: string | null;
  salutation?: string | null;
  dob?: string | null;
  others?: string | null;
}

export interface ContractDocument {
  name: string;
  filePath?: string | null;
  url?: string;
}

@Component({
  selector: "app-change-contract",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./change-contract.component.html",
  styleUrl: "./change-contract.component.css",
})
export class ChangeContractsComponent implements OnInit, OnDestroy {
  ChangeContracts: ChangeContract[] = [];

  isLoading = false;
  errorMessage = "";

  // Sidebar
  selectedRequest: ChangeContract | null = null;
  selectedIndex: number | null = null;
  isSidebarOpen = false;

  // Documents popup
  selectedDocuments: ContractDocument[] = [];
  isDocumentsOpen = false;

  // Search
  searchTerm = "";
  private searchTerm$ = new Subject<string>();
  private searchSub!: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.searchSub = this.searchTerm$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.fetchChangeContracts();
      });

    this.fetchChangeContracts();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value ?? "";
    this.searchTerm$.next(this.searchTerm);
  }

  clearSearch(): void {
    if (!this.searchTerm) {
      return;
    }

    this.searchTerm = "";
    this.searchTerm$.next("");
  }

  fetchChangeContracts(): void {
    this.isLoading = true;
    this.errorMessage = "";

    const payload = {
      search: this.searchTerm?.trim() || "",
      adminId: 1,
      page: 1,
    };

    this.http
      .post<any>(
        "http://192.168.0.155:8080/admin/fetch-all-customer-contract-edit-request",
        payload
      )
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;

          const items = Array.isArray(res?.data)
            ? res.data
            : [];

          this.ChangeContracts = items;
        },

        error: (err: any) => {
          this.isLoading = false;

          this.errorMessage =
            "Fehler beim Laden der Contract Edit Options";

          console.error(
            "Contract Edit Options API error:",
            err
          );
        },
      });
  }

  trackById(
    index: number,
    item: ChangeContract
  ): string | number {
    return `${item.deliveryId ?? "unknown"}-${
      item.selectedOption
        ?.contractEditSelectedOptionId ?? index
    }`;
  }

  getCustomerName(
    request: ChangeContract
  ): string {
    return (
      `${request.customer?.firstName ?? ""} ${
        request.customer?.lastName ?? ""
      }`.trim() || "—"
    );
  }

  customerInitial(
    request: ChangeContract
  ): string {
    const name = this.getCustomerName(request);

    return name.charAt(0).toUpperCase() || "G";
  }

  getOptionName(
    request: ChangeContract
  ): string {
    return (
      request.selectedOption?.optionName ||
      "Dokument"
    );
  }

  getChangedValue(
    request: ChangeContract
  ): string {
    return (
      request.firstName ??
      request.lastName ??
      request.salutation ??
      request.companyName ??
      request.title ??
      request.dob ??
      request.others ??
      "—"
    );
  }

  formatDate(timestamp?: number | string): string {
    if (!timestamp) {
      return "—";
    }

    let date: Date;

    if (typeof timestamp === "number") {
      date =
        timestamp.toString().length === 10
          ? new Date(timestamp * 1000)
          : new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  getBranchLabel(branch?: string): string {
    if (!branch) {
      return "—";
    }

    switch (branch.toUpperCase()) {
      case "ELECTRICITY":
        return "Strom";

      case "GAS":
        return "Gas";

      default:
        return branch;
    }
  }

  /**
   * Converts the backend Windows file path
   * into a browser-accessible document URL.
   *
   * Example:
   *
   * C:\...\assets\customers\last_name_proof\file.jpg
   *
   * becomes:
   *
   * http://192.168.0.155:8080/assets/customers/
   * last_name_proof/file.jpg
   */
  buildDocUrl(
    filePath?: string | null
  ): string {
    if (!filePath) {
      return "";
    }

    if (filePath.startsWith("http")) {
      return filePath;
    }

    const normalizedPath =
      filePath.replace(/\\/g, "/");

    const marker = "assets/customers/";

    const index =
      normalizedPath.indexOf(marker);

    if (index === -1) {
      return "";
    }

    const relativePath =
      normalizedPath.substring(
        index + marker.length
      );

    return `${DOC_BASE_URL}${relativePath}`;
  }

  getDocuments(
    request: ChangeContract
  ): ContractDocument[] {
    if (!request.filePath) {
      return [];
    }

    return [
      {
        name: this.getDocumentName(request),
        filePath: request.filePath,
        url: this.buildDocUrl(
          request.filePath
        ),
      },
    ];
  }

  getDocumentName(
    request: ChangeContract
  ): string {
    if (!request.filePath) {
      return this.getOptionName(request);
    }

    const path = request.filePath;

    const fileName = path
      .split("\\")
      .pop()
      ?.split("/")
      .pop();

    return (
      fileName || this.getOptionName(request)
    );
  }

  getStatusLabel(status?: number): string {
    if (status === 1) {
      return "Aktiv";
    }

    if (status === 2) {
      return "Inaktiv";
    }

    return "—";
  }

  openSidebar(
    request: ChangeContract,
    index: number
  ): void {
    if (
      this.isSidebarOpen &&
      this.selectedRequest === request
    ) {
      this.closeSidebar();
      return;
    }

    this.selectedRequest = request;
    this.selectedIndex = index;
    this.isSidebarOpen = true;
  }

  closeSidebar(): void {
    this.selectedRequest = null;
    this.selectedIndex = null;
    this.isSidebarOpen = false;
  }

  openDocuments(
    request: ChangeContract,
    event?: Event
  ): void {
    event?.stopPropagation();

    // Close the right sidebar when opening documents
    this.closeSidebar();

    this.selectedDocuments =
      this.getDocuments(request);

    this.isDocumentsOpen = true;
  }

  closeDocuments(event?: Event): void {
    event?.stopPropagation();

    this.selectedDocuments = [];
    this.isDocumentsOpen = false;
  }

  openDocument(
    document: ContractDocument
  ): void {
    if (!document.url) {
      return;
    }

    window.open(
      document.url,
      "_blank",
      "noopener"
    );
  }

  getDocumentCount(
    request: ChangeContract
  ): number {
    return this.getDocuments(request).length;
  }
}