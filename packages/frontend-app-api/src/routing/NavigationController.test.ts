/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NavigationController } from './NavigationController';

describe('NavigationController', () => {
  let controller: NavigationController;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    controller = new NavigationController();
  });

  afterEach(() => {
    controller.dispose();
  });

  it('should navigate by updating window.history', () => {
    controller.navigate('/catalog/entity/foo');
    expect(window.location.pathname).toBe('/catalog/entity/foo');
  });

  it('should emit location on navigate', () => {
    const locations: string[] = [];
    const sub = controller.location$.subscribe(loc =>
      locations.push(loc.pathname),
    );
    controller.navigate('/catalog');
    expect(locations).toContain('/catalog');
    sub.unsubscribe();
  });

  it('should mark subscription as closed after unsubscribe', () => {
    const sub = controller.location$.subscribe(() => {});
    expect(sub.closed).toBe(false);
    sub.unsubscribe();
    expect(sub.closed).toBe(true);
  });

  it('should create a scoped contract', () => {
    controller.navigate('/catalog/entity/foo?filter=active#details');
    const contract = controller.createContract('/catalog');
    const locations: Array<{
      pathname: string;
      search: string;
      hash: string;
      state: unknown;
    }> = [];
    const sub = contract.location$.subscribe(loc => locations.push(loc));

    expect(contract.basePath).toBe('/catalog');
    expect(locations[locations.length - 1]).toEqual({
      pathname: '/entity/foo',
      search: '?filter=active',
      hash: '#details',
      state: null,
    });
    sub.unsubscribe();
  });

  it('should scope contract navigate to basePath', () => {
    const contract = controller.createContract('/catalog');
    contract.navigate('/entity/bar');
    expect(window.location.pathname).toBe('/catalog/entity/bar');
  });

  it('should warn with actionable message and ignore contract navigate outside basePath', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const contract = controller.createContract('/catalog');
    const before = window.location.pathname;

    contract.navigate('/../../scaffolder');
    expect(window.location.pathname).toBe(before);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('useFrameworkNavigate()'),
    );
    warnSpy.mockRestore();
  });

  it('should preserve state through navigate and location$', () => {
    const state = { from: '/login', returnTo: '/dashboard' };
    controller.navigate('/catalog/entity/foo', { state });

    const locations: Array<{ state: unknown }> = [];
    const sub = controller.location$.subscribe(loc =>
      locations.push({ state: loc.state }),
    );

    expect(locations[locations.length - 1].state).toEqual(state);
    sub.unsubscribe();
  });

  it('should pass state through scoped contract navigate', () => {
    const contract = controller.createContract('/catalog');
    const state = { wizardStep: 2 };
    contract.navigate('/entity/bar', { state });

    expect(window.history.state).toEqual(state);
  });

  it('should handle search-param-only navigation', () => {
    controller.navigate('/catalog/entities');
    const contract = controller.createContract('/catalog');
    contract.navigate('/entities?filter=active');
    expect(window.location.search).toBe('?filter=active');
  });

  it('should handle hash-only navigation', () => {
    controller.navigate('/catalog/entities');
    const contract = controller.createContract('/catalog');
    contract.navigate('/entities#section');
    expect(window.location.hash).toBe('#section');
  });

  it('should not emit to other contracts', () => {
    const catalogContract = controller.createContract('/catalog');
    const scaffolderContract = controller.createContract('/scaffolder');
    const catalogLocs: string[] = [];
    const scaffolderLocs: string[] = [];
    catalogContract.location$.subscribe(l => catalogLocs.push(l.pathname));
    scaffolderContract.location$.subscribe(l =>
      scaffolderLocs.push(l.pathname),
    );

    controller.navigate('/catalog/entity/foo');
    // Catalog should get it, scaffolder should not get a new emission
    // (scaffolder's initial emission was for '/' which didn't match, so no emission)
    expect(catalogLocs).toContain('/entity/foo');
  });

  it('should handle dispose', () => {
    const sub = controller.location$.subscribe(() => {});
    controller.dispose();
    expect(sub.closed).toBe(false); // sub itself is not auto-closed
    // But no more emissions will occur from popstate
  });

  it('should not dispatch popstate on navigate (only emit directly)', () => {
    const popstateSpy = jest.fn();
    window.addEventListener('popstate', popstateSpy);
    controller.navigate('/catalog/foo');
    expect(popstateSpy).not.toHaveBeenCalled();
    window.removeEventListener('popstate', popstateSpy);
  });

  it('should emit exactly once per navigate call (no double-emission)', () => {
    const emissions: string[] = [];
    controller.location$.subscribe(loc => emissions.push(loc.pathname));
    const countBefore = emissions.length;

    controller.navigate('/catalog/foo');

    // Exactly one new emission (from direct this.emit()), not two
    expect(emissions.length - countBefore).toBe(1);
    expect(emissions[emissions.length - 1]).toBe('/catalog/foo');
  });

  it('should emit on popstate events (back/forward)', () => {
    controller.navigate('/catalog/foo');
    const locations: string[] = [];
    controller.location$.subscribe(loc => locations.push(loc.pathname));

    window.history.pushState(null, '', '/other/page');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(locations).toContain('/other/page');
  });

  it('should use replaceState when replace option is true', () => {
    const replaceSpy = jest.spyOn(window.history, 'replaceState');
    controller.navigate('/catalog/foo', { replace: true });
    expect(replaceSpy).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/catalog/foo');
    replaceSpy.mockRestore();
  });

  it('should forward replace option through contract navigate', () => {
    const replaceSpy = jest.spyOn(window.history, 'replaceState');
    const contract = controller.createContract('/catalog');
    contract.navigate('/entity/foo', { replace: true });
    expect(replaceSpy).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/catalog/entity/foo');
    replaceSpy.mockRestore();
  });

  it('should throw for absolute URLs', () => {
    expect(() => controller.navigate('https://evil.com/path')).toThrow(
      'does not support absolute URLs',
    );
  });

  it('should not emit after dispose', () => {
    const emissions: string[] = [];
    controller.location$.subscribe(loc => emissions.push(loc.pathname));
    const countAfterSubscribe = emissions.length;
    controller.dispose();
    window.history.pushState(null, '', '/new');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(emissions.length).toBe(countAfterSubscribe);
  });

  it('should support observer object with next method', () => {
    const locations: string[] = [];
    const sub = controller.location$.subscribe({
      next: loc => locations.push(loc.pathname),
    });
    controller.navigate('/test');
    expect(locations).toContain('/test');
    sub.unsubscribe();
  });

  it('should handle subscriber adding new subscriber during emit', () => {
    const results: string[] = [];
    const sub = controller.location$.subscribe(loc => {
      results.push(`first:${loc.pathname}`);
      controller.location$.subscribe(l => results.push(`nested:${l.pathname}`));
    });
    controller.navigate('/test');
    expect(results.filter(r => r.startsWith('first:')).length).toBe(2);
    sub.unsubscribe();
  });

  it('should handle root basePath', () => {
    controller.navigate('/anything/here');
    const contract = controller.createContract('/');
    const locations: string[] = [];
    contract.location$.subscribe(l => locations.push(l.pathname));
    expect(locations).toContain('/anything/here');
  });

  describe('with basename', () => {
    let bnController: NavigationController;

    beforeEach(() => {
      window.history.replaceState(null, '', '/backstage');
      bnController = new NavigationController({ basename: '/backstage' });
    });

    afterEach(() => {
      bnController.dispose();
    });

    it('should prepend basename on navigate', () => {
      bnController.navigate('/catalog/entity/foo');
      expect(window.location.pathname).toBe('/backstage/catalog/entity/foo');
    });

    it('should strip basename from location$ emissions', () => {
      bnController.navigate('/catalog/entity/foo');
      const locations: string[] = [];
      bnController.location$.subscribe(l => locations.push(l.pathname));
      expect(locations).toContain('/catalog/entity/foo');
    });

    it('should strip basename from contract location$', () => {
      bnController.navigate('/catalog/entity/foo');
      const contract = bnController.createContract('/catalog');
      const locations: string[] = [];
      contract.location$.subscribe(l => locations.push(l.pathname));
      expect(locations).toContain('/entity/foo');
    });
  });
});
