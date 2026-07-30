export interface SPPNotificationParams {
  studentName?: string;
  month: number;
  year: number;
  amount: number;
  dueDate?: Date | string;
  invoiceNumber?: string;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatIndonesianDate(date: Date | string): string {
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Template Notifikasi Publikasi SPP (Admin IT -> Siswa)
 */
export function createSPPPaymentPublishedNotification(params: SPPNotificationParams) {
  const monthLabel = MONTH_NAMES[params.month - 1] || `Bulan ${params.month}`;
  const amountStr = formatRupiah(params.amount);
  const dueDateStr = params.dueDate ? formatIndonesianDate(params.dueDate) : "tanggal jatuh tempo";

  return {
    title: `Tagihan SPP ${monthLabel} ${params.year}`,
    message: `Halo${params.studentName ? ' ' + params.studentName : ''}, tagihan SPP Anda untuk bulan ${monthLabel} ${params.year} sebesar ${amountStr} telah diterbitkan. Mohon lakukan pembayaran sebelum ${dueDateStr}.`,
    type: "PAYMENT" as const,
    link: "/dashboard/siswa/pembayaran",
  };
}

/**
 * Template Notifikasi Pembayaran SPP Berhasil
 */
export function createSPPPaymentSuccessNotification(params: {
  studentName?: string;
  month: number;
  year: number;
  amount: number;
  invoiceNumber: string;
}) {
  const monthLabel = MONTH_NAMES[params.month - 1] || `Bulan ${params.month}`;
  const amountStr = formatRupiah(params.amount);

  return {
    title: `Pembayaran SPP ${monthLabel} ${params.year} Berhasil`,
    message: `Terima kasih${params.studentName ? ' ' + params.studentName : ''}, pembayaran SPP bulan ${monthLabel} ${params.year} sejumlah ${amountStr} (${params.invoiceNumber}) telah berhasil diverifikasi.`,
    type: "SUCCESS" as const,
    link: "/dashboard/siswa/pembayaran",
  };
}
