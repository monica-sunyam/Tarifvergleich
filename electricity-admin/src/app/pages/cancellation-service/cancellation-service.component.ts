import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { AuthService } from "../../shared/services/auth.service";

const API_BASE = "http://192.168.0.155:8080";
export interface CancellationRequest {
  CustomerContractCancellationRequestId: number;
  selectedCategory: {
    contractCancellationCategoryId: number;
    categoryName: string;
  };
  counselling: {
    cousellingId: number;
    mobileNumber: string;
    weekDay: string;
    timeSlot: string;
    description: string;
    scheduleDate: number | null;
    createdOn: number;
    customer: {
      id: number;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      userType: string | null;
      title: string | null;
      salutation: string | null;
    };
    concluded: boolean;
    deliveryId: number;
    isCancellationRequest: boolean;
  };
  customer: {
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    userType: string | null;
    title: string | null;
    salutation: string | null;
  };
  energyBranch: string;
  deliveryId: number;
  reason: string;
  desiredDate: number;
  terminationType: string;
  additionalInfo: string;
  status: number;
  createdOn: number;
  resolvedOn: number | null;
  rejectedOn: number | null;
}

@Component({
  selector: "app-cancellation-service",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cancellation-service.component.html",
  styleUrl: "./cancellation-service.component.css",
})
export class CancellationRequestsComponent implements OnInit {
  requests: CancellationRequest[] = [];

  isLoading = false;
  errorMessage = "";
  expandedRow: number | null = null;

  currentPage = 1;
  totalPages = 1;
  private readonly PAGE_SIZE = 10;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.fetchCancellationRequests(1);
  }

  fetchCancellationRequests(page: number = 1): void {
    this.currentPage = page;
    this.isLoading = true;
    this.errorMessage = "";
    this.expandedRow = null;

    const payload = {
      adminId: this.authService.getUserId(),
      page: this.currentPage,
      size: this.PAGE_SIZE,
    };

    this.http
      .post<any>(
        `${API_BASE}/admin/fetch-all-customer-contract-cancellation-request`,
        payload,
      )
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res?.res && Array.isArray(res.data)) {
            this.requests = res.data;
            this.totalPages = res.totalPage ?? 1;
          } else {
            this.errorMessage = "Ungültige Serverantwort.";
          }
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = "Fehler beim Laden der Kündigungsanfragen.";
        },
      });
  }

  toggleRow(id: number): void {
    this.expandedRow = this.expandedRow === id ? null : id;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.fetchCancellationRequests(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.fetchCancellationRequests(this.currentPage - 1);
    }
  }

  statusLabel(req: CancellationRequest): string {
    if (req.status == 1) return "Im Gange";
    if (req.status == 2) return "Nach vorne";
    return "Offen";
  }

  statusClasses(req: CancellationRequest): string {
    if (req.resolvedOn) return "bg-green-100 text-green-700";
    if (req.rejectedOn) return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  }

  openBookingDetails(deliveryId: number | null | undefined, event?: Event): void {
    event?.stopPropagation();
    if (!deliveryId) return;
    window.location.href = `/bookings/${deliveryId}`;
  }
}