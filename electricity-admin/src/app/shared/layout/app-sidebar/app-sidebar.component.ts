import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { SidebarService } from "../../services/sidebar.service";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { SafeHtmlPipe } from "../../pipe/safe-html.pipe";
import { combineLatest, Subscription, filter, first } from "rxjs";

type NavItem = {
  name: string;
  icon: string;
  path?: string;
  new?: boolean;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterModule, SafeHtmlPipe],
  templateUrl: "./app-sidebar.component.html",
})
export class AppSidebarComponent implements OnInit, OnDestroy {
  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription = new Subscription();
  navItems: NavItem[] = [
    {
      name: "Dashboard",
      path: "/",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <path d="M5.5 3.25C4.25736 3.25 3.25 4.25736 3.25 5.5V8.99998C3.25 10.2426 4.25736 11.25 5.5 11.25H9C10.2426 11.25 11.25 10.2426 11.25 8.99998V5.5C11.25 4.25736 10.2426 3.25 9 3.25H5.5Z" fill="currentColor"></path>
      <path d="M15 3.25C13.7574 3.25 12.75 4.25736 12.75 5.5V8.99998C12.75 10.2426 13.7574 11.25 15 11.25H18.5C19.7426 11.25 20.75 10.2426 20.75 8.99998V5.5C20.75 4.25736 19.7426 3.25 18.5 3.25H15Z" fill="currentColor"></path>
      <path d="M5.5 12.75C4.25736 12.75 3.25 13.7574 3.25 15V18.5C3.25 19.7426 4.25736 20.75 5.5 20.75H9C10.2426 20.75 11.25 19.7426 11.25 18.5V15C11.25 13.7574 10.2426 12.75 9 12.75H5.5Z" fill="currentColor"></path>
      <path d="M15 12.75C13.7574 12.75 12.75 13.7574 12.75 15V18.5C12.75 19.7426 13.7574 20.75 15 20.75H18.5C19.7426 20.75 20.75 19.7426 20.75 18.5V15C20.75 13.7574 19.7426 12.75 18.5 12.75H15Z" fill="currentColor"></path>
    </svg>`,
    },
    {
      name: "Menus",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
      subItems: [
        { name: "Navigation Menus", path: "/menus/navigation" },
        { name: "Sidebar Menus", path: "/menus/sidebar" },
      ],
    },
    {
      name: "Services",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
      subItems: [{ name: "All Services", path: "/services/free" }],
    },
    {
      name: "About Us",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 16C10.3431 16 9 14.6569 9 13C9 11.3431 10.3431 10 12 10C13.6569 10 15 11.3431 15 13C15 14.6569 13.6569 16 12 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 10V8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
      subItems: [{ name: "About Us", path: "/about-us" }],
    },
    {
      name: "Banners",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <path d="M4 4H20V20H4V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 9H20M4 15H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
      subItems: [{ name: "Banners", path: "/banners" }],
    },
    {
      name: "Customers",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <path d="M16 21V19C16 17.8954 15.1046 17 14 17H6C4.89543 17 4 17.8954 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="2"/>
      <path d="M20 21V19C20 18.067 19.3638 17.2519 18.5 17.0127" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 3.28906C16.3968 3.64352 17 4.52164 17 5.5C17 6.47836 16.3968 7.35648 15.5 7.71094" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
      subItems: [
        { name: "Customer List", path: "/customers" },
        { name: "Holiday Markers", path: "/customers/holiday-markers" },
      ],
    },
    {
      name: "Bookings",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
      <path d="M8 2V6M16 2V6M3 10H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 14H12M8 18H10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
      subItems: [{ name: "Booking List", path: "/bookings" }],
    },
    {
      name: "Customer comparison",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
    </svg>`,
      subItems: [{ name: "Comparison List", path: "/comparisons" }],
    },
    {
      name: "Customer Queries",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>`,
      subItems: [
        // { name: "Service Requests", path: "/customer-query/customer-queries" },
        { name: "Contact Queries", path: "/contact-query/list" },
      ],
    },
    {
      name: "Service Requests",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M9 8h6" />
    </svg>`,
      subItems: [
        { name: "Service Requests", path: "/customer-query/customer-queries" },
        { name: "Cancellation Service", path: "/cancellation-service/cancellation-service-request" },
      ],
    },
    {
      name: "Callback Requests",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 4H9L11 9L8.5 10.5C10 13.5 12.5 16 15.5 17.5L17 15L22 17V21C22 21.55 21.55 22 21 22C10.51 22 2 13.49 2 3C2 2.45 2.45 2 3 2H7L5 4Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>`,
      subItems: [{ name: "Callback Requests", path: "/customer-callback" }],
    },
    {
      name: "Email",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6H20V18H4V6Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"/>
        <path d="M4 7L12 13L20 7"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"/>
      </svg>`,
      subItems: [
        {
          name: "Email Template",
          path: "/email-template",
        },
        // {
        //   name: "Email Category",
        //   path: "/email-category",
        // },
      ],
    },
    {
      name: "Content",
      icon: `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />

          <path
            d="M8 8H16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M8 12H16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M8 16H13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      `,
      subItems: [
        {
          name: "Content Pdf",
          path: "/content",
        },
        {
          name: "Static Content",
          path: "/static-content",
        },
      ],
    },
    {
      name: "Categories",
      icon: `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      subItems: [
        {
          name: "Energy Supply",
          path: "/categories",
        },
        { name: "Query Categories", path: "/customer-query/categories" },
        {
          name: "Invoice Categories",
          path: "/invoice-categories",
        },
        {
          name: "Report Meter Reading Category",
          path: "/report-meter-reading-category",
        },
        {
          name: "Cancellation Service Category",
          path: "/cancellation-service-category",
        },
      ],
    },
    {
      name: "Credentials",
      icon: `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      subItems: [
        {
          name: "Admin Signature",
          path: "/credentials/admin-signature",
        },
        {
          name: "Tax Management",
          path: "/credentials/tax-management",
        },
      ],
    },

    {
      name: "Open Provider Action",
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C7.03 2 3 6.03 3 11V20C3 20.55 3.45 21 4 21H20C20.55 21 21 20.55 21 20V11C21 6.03 16.97 2 12 2Z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12L15 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>`,
      subItems: [
        {
          name: "Report Meter Reading",
          path: "/open-provider-action/report-meter-reading",
        },
        {
          name: "Invoice Request",
          path: "/open-provider-action/customer-invoice-request",
        },
        {
          name: "Energy Supplier Messages",
          path: "/open-provider-action/energy-supplier",
        },
        {
          name: "Change Advance Payment Request",
          path: "/open-provider-action/change-amount",
        },
        {
          name: "Change Contract Details",
          path: "/open-provider-action/change-contract",
        },
      ],
    },
  ];

  openSubmenu: string | null = null;
  subMenuHeights: { [key: string]: number } = {};

  // Use @ViewChildren to get references to submenu containers
  @ViewChildren("subMenu") subMenuRefs!: QueryList<ElementRef>;

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    // 1. Router Subscription
    this.subscription.add(
      this.router.events
        .pipe(
          filter(
            (event): event is NavigationEnd => event instanceof NavigationEnd,
          ),
        )
        .subscribe((event) => {
          this.setActiveMenuFromRoute(event.urlAfterRedirects);
        }),
    );

    // 2. Sidebar State Subscription
    this.subscription.add(
      combineLatest([
        this.isExpanded$,
        this.isMobileOpen$,
        this.isHovered$,
      ]).subscribe(([isExpanded, isMobileOpen, isHovered]) => {
        if (!isExpanded && !isMobileOpen && !isHovered) {
          // Optional: Close menus when sidebar collapses
          // this.openSubmenu = null;
        }
        this.cdr.markForCheck();
      }),
    );

    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  toggleSubmenu(section: string, index: number) {
    const key = `${section}-${index}`;

    if (this.openSubmenu === key) {
      this.openSubmenu = null;
      this.subMenuHeights[key] = 0;
    } else {
      this.openSubmenu = key;
      this.calculateHeight(key);
    }
  }

  private calculateHeight(key: string) {
    // Use requestAnimationFrame or setTimeout to wait for DOM rendering
    setTimeout(() => {
      const el = document.getElementById(key);
      if (el) {
        this.subMenuHeights[key] = el.scrollHeight;
        this.cdr.markForCheck();
      }
    });
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    this.navItems.forEach((nav, i) => {
      if (nav.subItems?.some((sub) => currentUrl.startsWith(sub.path))) {
        const key = `main-${i}`;
        this.openSubmenu = key;
        this.calculateHeight(key);
      }
    });
  }

  onSidebarMouseEnter() {
    this.isExpanded$.pipe(first()).subscribe((expanded) => {
      if (!expanded) this.sidebarService.setHovered(true);
    });
  }

  onSubmenuClick() {
    this.isMobileOpen$.pipe(first()).subscribe((isMobile) => {
      if (isMobile) this.sidebarService.setMobileOpen(false);
    });
  }

  isActive(path: string | undefined): boolean {
    if (!path) return false;

    // Get the current URL without query params or fragments
    const currentUrl = this.router.url.split("?")[0].split("#")[0];

    // Exact match for the path
    return currentUrl === path;
  }

  isActiveInSubmenu(subItems: { path: string }[]): boolean {
    return subItems.some((sub) => this.isActive(sub.path));
  }
}
