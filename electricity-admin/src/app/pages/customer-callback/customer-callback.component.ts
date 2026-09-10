import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { AuthService } from "../../shared/services/auth.service";
import { ApiService } from "../../shared/services/api.service";

export type CallbackCustomer = {
  cousellingId: number;

  mobileNumber: string;
  weekDay: string;
  timeSlot: string;
  description: string;
  scheduleDate: number;
  createdOn: number;
  concluded: boolean;

  customer: {
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    userType: string | null;
    title: string | null;
    salutation: string | null;
  };

  deliveryId?: number | null;
  isCancellationRequest?: boolean;
};

@Component({
  selector: "app-customer-callback",
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./customer-callback.component.html",
  styleUrl: "./customer-callback.component.css",
})
export class CustomerCallbackComponent {
  constructor(
    private api: ApiService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.fetchCustomers();
  }
  customers: CallbackCustomer[] = [];

  isLoading = false;
  errorMessage = "";

  customerNotes: Record<string | number, string> = {};
  selectedCustomer: CallbackCustomer | null = null;
  hasMoreData = true;
  private readonly PAGE_LIMIT = 20;
  currentPage = 1;
  totalPage: number | null = null;

  selectedStatus: string = "";

  onFilterChange(): void {
    this.fetchCustomers(1);
  }
  totalRecords = 0;
  totalConsluded = 0;
  totalUnconcluded = 0;
  fetchCustomers(page: number = 1): void {
    this.currentPage = page;
    const payload = {
      adminId: this.authService.getUserId(),
      page: this.currentPage,
      size: this.PAGE_LIMIT,
      concluded:
        this.selectedStatus === "" ? undefined : this.selectedStatus === "true",
    };

    this.isLoading = true;
    this.errorMessage = "";
    // this.selectedCustomer = null;

    this.api.post("admin/fetch-counselling-request", payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        const newData = res?.data || [];
        this.totalRecords = res?.totalRecords || 0;
        this.totalConsluded = res?.totalConsluded || 0;
        this.totalUnconcluded = res?.totalUnconcluded || 0;
        this.customers = newData;

        this.totalPage = res?.totalPage ?? 0;

        this.hasMoreData = this.currentPage < (res?.totalPage ?? 0);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = "Fehler beim Laden der Kundenliste.";
      },
    });
  }

  nextPage(): void {
    if (this.currentPage < this.totalPage!) {
      this.fetchCustomers(this.currentPage + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.fetchCustomers(this.currentPage - 1);
    }
  }

  // ── Booking details ──────────────────────────────────────────────────────
  openBookingDetails(
    deliveryId: number | null | undefined,
    event?: Event,
  ): void {
    event?.stopPropagation();
    if (!deliveryId) return;
    window.location.href = `/bookings/${deliveryId}`;
  }

  toggleCallbackStatus(item: any) {
    const newStatus = !item.concluded;

    const payload = {
      adminId: this.authService.getUserId(),
      counsellingId: item.cousellingId,
      concluded: newStatus,
    };

    this.api.post("admin/toggle-counselling-request", payload).subscribe({
      next: (res: any) => {
        if (res?.res) {
          item.concluded = newStatus;

          if (newStatus) {
            this.totalConsluded++;
            this.totalUnconcluded--;
          } else {
            this.totalConsluded--;
            this.totalUnconcluded++;
          }
        }
      },

      error: (err) => {
        console.error("Failed to update callback status", err);
      },
    });
  }
}
