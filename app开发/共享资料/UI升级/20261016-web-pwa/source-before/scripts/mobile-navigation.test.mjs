import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const navbar = read('src/components/Navbar_v2.tsx');
const floatingToolbar = read('src/components/FloatingToolbar.tsx');
const navigation = read('src/config/navigation.ts');
const profilePage = read('src/app/dashboard/profile/page.tsx');

test('mobile parent navigation keeps the section link separate from submenu expansion', () => {
  assert.match(
    navbar,
    /href=\{item\.href\}[\s\S]*onClick=\{\(event\) => navigateFromMobileMenu\(event, item\.href\)\}/,
  );
  assert.match(navbar, /aria-label=\{`\$\{isExpanded \? '收起' : '展开'\}\$\{item\.label\}子菜单`\}/);
  assert.match(navbar, /onClick=\{\(\) => setExpandedMobileItem\(isExpanded \? null : item\.label\)\}/);
});

test('mobile navigation uses a full page transition that survives auth-triggered rerenders', () => {
  assert.match(navbar, /const navigateFromMobileMenu = useCallback/);
  assert.match(navbar, /event\.preventDefault\(\);[\s\S]*closeMobileMenu\(\);[\s\S]*window\.location\.assign\(href\)/);
  const navigationHandlers = navbar.match(/navigateFromMobileMenu\(event, (?:item|child)\.href\)/g) || [];
  assert.ok(navigationHandlers.length >= 3, 'parent, direct and child links should all use reliable mobile navigation');
});

test('logged-in profile entry uses the same reliable mobile navigation path', () => {
  assert.match(
    navbar,
    /href="\/dashboard\/profile"[\s\S]*onClick=\{\(event\) => navigateFromMobileMenu\(event, '\/dashboard\/profile'\)\}/,
  );
});

test('mobile message entry is an icon beside the signed-in student name', () => {
  assert.match(navbar, /className="mobile-student-message-link[^\"]*"/);
  assert.match(navbar, /mobile-student-message-link[\s\S]*?<Bell className="h-4 w-4"/);
  assert.doesNotMatch(navbar, />\s*我的消息\s*<\/span>/);
});

test('mobile login is a dedicated header icon and is absent from the dropdown menu', () => {
  assert.match(navbar, /const mobileUserButton = mobileStudent \? \([\s\S]*?className="mobile-user-action/);
  assert.match(navbar, /onClick=\{openMobileLogin\}[\s\S]*?aria-label="打开登录窗口"/);
  assert.match(navbar, /<Headphones[\s\S]*?\{mobileMenuButton\}[\s\S]*?\{mobileUserButton\}/);

  const mobileMenuStart = navbar.indexOf('aria-label="移动端导航菜单"');
  const mobileMenuEnd = navbar.indexOf('<SiteSearch', mobileMenuStart);
  const mobileMenuSource = navbar.slice(mobileMenuStart, mobileMenuEnd);
  assert.ok(mobileMenuStart >= 0 && mobileMenuEnd > mobileMenuStart, 'mobile dropdown menu should exist');
  assert.doesNotMatch(mobileMenuSource, /onClick=\{openMobileLogin\}/);
});

test('site shell switches to desktop layout at the same 768px breakpoint as course content', () => {
  assert.match(navbar, /<header className="[^"]*md:hidden"/);
  assert.match(navbar, /className="[^"]*md:block"[\s\S]*data-navbar-tone=\{desktopNavbarTone\}/);
  assert.match(navbar, /<nav className="[^"]*md:flex/);
  assert.match(floatingToolbar, /hidden md:flex flex-col/);
});

test('compact desktop header preserves one-line navigation below 1024px', () => {
  assert.match(navbar, /hidden font-serif text-lg font-bold transition-colors lg:inline/);
  assert.match(navbar, /whitespace-nowrap[^']*text-xs[^']*lg:text-sm/);
  assert.match(navbar, /hidden items-center gap-2[^\"]*lg:flex/);
});

test('offline training remains a top-level navigation item without a submenu', () => {
  assert.match(navigation, /label:\s*['"]线下培训['"],\s*href:\s*['"]\/offline['"]/);
  assert.doesNotMatch(navigation, /label:\s*['"](?:系统集训|课程日历|大师营)['"]/);
});

test('profile course cards use resilient document navigation and bypass the broken image optimizer path', () => {
  assert.match(
    profilePage,
    /<a[\s\S]*href=\{getCourseVideoHref\(\{ courseId: course\.id, platformSeriesId: course\.id \}\)\}/,
  );
  assert.match(
    profilePage,
    /<Image src=\{course\.cover\}[\s\S]*unoptimized/,
  );
});

test('mobile profile keeps the member name and phone on one responsive line', () => {
  assert.match(
    profilePage,
    /<h1 className="[^"]*truncate[^"]*whitespace-nowrap[^"]*">\{displayName\}<\/h1>/,
  );
  assert.match(
    profilePage,
    /<span className="shrink-0 whitespace-nowrap tabular-nums">\{knownPhone \|\| '未绑定手机号'\}<\/span>/,
  );
  assert.doesNotMatch(profilePage, /<h1 className="[^"]*break-words[^"]*">\{displayName\}<\/h1>/);
});
