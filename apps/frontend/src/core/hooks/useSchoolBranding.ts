import { useState, useEffect } from 'react';
import { tenantApi, TenantProfile } from '../api/tenant.api';

export const DEFAULT_SCHOOL_NAME = 'KidMeal';
export const DEFAULT_HOTLINE = '028 3930 1888';

export interface SchoolBrandingInfo {
    name: string;
    code: string;
    address: string;
    phone: string;
    contactEmail: string;
    domain: string;
    logoUrl: string | null;
    primaryColor: 'TEAL' | 'YELLOW' | 'ORANGE';
    foodSafetyLicense?: {
        number?: string;
        issueDate?: string;
        expiryDate?: string;
        issuingAuthority?: string;
    };
    legalRepresentative?: {
        name?: string;
        title?: string;
    };
    operationalSettings?: {
        mealTimes?: string[];
        standardWeeklyCycleLength?: number;
        foodRetentionHours?: number;
        whoZscoreAutoCalc?: boolean;
    };
}

// Giữ lại alias SchoolBranding để tương thích ngược
export type SchoolBranding = SchoolBrandingInfo;

const syncFaviconAndTitle = (name?: string, logoUrl?: string | null) => {
    if (typeof document === 'undefined') return;
    if (name) {
        if (!document.title.includes(name)) {
            document.title = `${name} · KidMeal`;
        }
    }
    if (logoUrl) {
        let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.getElementsByTagName('head')[0]?.appendChild(favicon);
        }
        favicon.href = logoUrl;
    }
};

/**
 * Hook to retrieve and subscribe to school branding (school name, logo, legal, operational config).
 * Automatically updates when branding is changed in SchoolSettingsPage
 * via localStorage, 'tenant-profile-updated' and 'school-branding-updated' events.
 */
export const useSchoolBranding = (): SchoolBrandingInfo => {
    const [branding, setBranding] = useState<SchoolBrandingInfo>(() => {
        const storedLogo = localStorage.getItem('school_logo');
        let storedName = localStorage.getItem('school_name');
        if (!storedName || storedName.includes('Hướng Dương') || storedName.includes('Trường Mẫu')) {
            storedName = DEFAULT_SCHOOL_NAME;
            localStorage.setItem('school_name', DEFAULT_SCHOOL_NAME);
        }
        const storedColor = (localStorage.getItem('school_primary_color') as any) || 'TEAL';
        syncFaviconAndTitle(storedName, storedLogo);
        return {
            name: storedName,
            code: localStorage.getItem('school_code') || '',
            address: localStorage.getItem('school_address') || '',
            phone: localStorage.getItem('school_phone') || DEFAULT_HOTLINE,
            contactEmail: localStorage.getItem('school_email') || '',
            domain: '',
            logoUrl: storedLogo !== null ? storedLogo : null,
            primaryColor: storedColor,
        };
    });

    useEffect(() => {
        let isMounted = true;

        const applyData = (data: TenantProfile) => {
            if (!isMounted || !data) return;
            const logo = data.branding?.logoUrl !== undefined ? (data.branding.logoUrl || null) : null;
            const name = data.name || DEFAULT_SCHOOL_NAME;
            const phone = data.phone || DEFAULT_HOTLINE;
            const address = data.address || '';
            const email = data.contactEmail || '';
            const code = data.code || '';
            const primaryColor = data.branding?.primaryColor || 'TEAL';

            const next: SchoolBrandingInfo = {
                name,
                code,
                address,
                phone,
                contactEmail: email,
                domain: data.domain || '',
                logoUrl: logo,
                primaryColor,
                foodSafetyLicense: data.foodSafetyLicense,
                legalRepresentative: data.legalRepresentative,
                operationalSettings: data.operationalSettings,
            };

            setBranding(next);

            if (name) localStorage.setItem('school_name', name);
            if (logo !== null) localStorage.setItem('school_logo', logo || '');
            if (phone) localStorage.setItem('school_phone', phone);
            if (address) localStorage.setItem('school_address', address);
            if (email) localStorage.setItem('school_email', email);
            if (code) localStorage.setItem('school_code', code);
            localStorage.setItem('school_primary_color', primaryColor);

            syncFaviconAndTitle(name, logo);
        };

        const fetchProfile = async () => {
            try {
                const data = await tenantApi.getProfile();
                applyData(data);
            } catch {
                // Fallback to local storage if API is offline
            }
        };

        fetchProfile();

        const handleCustomEvent = (e: Event) => {
            const detail = (e as CustomEvent<TenantProfile>).detail;
            if (detail && typeof detail === 'object') {
                applyData(detail);
            } else {
                fetchProfile();
            }
        };

        const handleStorageUpdate = () => {
            if (!isMounted) return;
            const storedName = localStorage.getItem('school_name') || DEFAULT_SCHOOL_NAME;
            const storedLogo = localStorage.getItem('school_logo');
            const storedPhone = localStorage.getItem('school_phone') || DEFAULT_HOTLINE;
            const storedAddress = localStorage.getItem('school_address') || '';
            const storedEmail = localStorage.getItem('school_email') || '';
            const storedColor = (localStorage.getItem('school_primary_color') as any) || 'TEAL';

            setBranding((prev) => ({
                ...prev,
                name: storedName,
                logoUrl: storedLogo !== null ? storedLogo : prev.logoUrl,
                phone: storedPhone,
                address: storedAddress,
                contactEmail: storedEmail,
                primaryColor: storedColor,
            }));
            syncFaviconAndTitle(storedName, storedLogo);
        };

        window.addEventListener('tenant-profile-updated', handleCustomEvent);
        window.addEventListener('school-branding-updated', handleCustomEvent);
        window.addEventListener('storage', handleStorageUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('tenant-profile-updated', handleCustomEvent);
            window.removeEventListener('school-branding-updated', handleCustomEvent);
            window.removeEventListener('storage', handleStorageUpdate);
        };
    }, []);

    return branding;
};
