/**
 * Dynamic Footer Component
 * Handles the generation and injection of the page footer.
 */

function initFooter() {
    if (!currentUser) return; // Don't render footer if not logged in
    if (document.querySelector('footer')) return; // Avoid duplicate footers

    const footerHtml = `
        <footer class="bg-white mt-12 py-6 border-t no-print">
            <div class="container mx-auto px-4">
                <p class="text-center text-gray-600" id="footerText">© 2025 โรงเรียนบ้านสร้างสื่อ</p>
            </div>
        </footer>
    `;

    document.body.insertAdjacentHTML('beforeend', footerHtml);
}
