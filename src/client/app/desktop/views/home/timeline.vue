<template>
<div class="pwbzawku">
	<mk-post-form class="form" v-if="$store.state.settings.showPostFormOnTopOfTl"/>
	<div class="main">
		<component :is="src == 'list' ? 'mk-user-list-timeline' : 'x-core'" ref="tl" v-bind="options">
			<header class="zahtxcqi">
				<div :data-active="src == 'home'" @click="src = 'home'"><fa icon="home"/> {{ $t('home') }}</div>
				<div :data-active="src == 'local'" @click="src = 'local'" v-if="enableLocalTimeline"><fa :icon="['far', 'comments']"/> {{ $t('local') }}</div>
				<div :data-active="src == 'hybrid'" @click="src = 'hybrid'" v-if="enableLocalTimeline" :title="$t('hybrid-desc')"><fa icon="share-alt"/> {{ $t('hybrid') }}</div>
				<div :data-active="src == 'global'" @click="src = 'global'" v-if="enableGlobalTimeline"><fa icon="globe"/> {{ $t('global') }}</div>
				<div :data-active="src == 'tag'" @click="src = 'tag'" v-if="tagTl"><fa icon="hashtag"/> {{ tagTl.title }}</div>
				<div :data-active="src == 'list'" @click="src = 'list'" v-if="list"><fa icon="list"/> {{ list.title }}</div>
				<div class="buttons">
					<button :data-active="src == 'hot'" @click="src = 'hot'" :title="$t('reacted')"><fa :icon="faThumbsUp"/></button>
					<button :data-active="src == 'locao'" @click="src = 'locao'" :title="$t('locao')" v-if="enableLocalTimeline"><fa icon="heart"/></button>
					<button :data-active="src == 'another'" @click="src = 'another'" :title="$t('another')" v-if="enableLocalTimeline"><fa :icon="faQuestion"/></button>
					<button :data-active="src == 'mentions'" @click="src = 'mentions'" :title="$t('mentions')"><fa icon="at"/><i class="indicator" v-if="$store.state.i.hasUnreadMentions"><fa icon="circle"/></i></button>
					<button :data-active="src == 'messages'" @click="src = 'messages'" :title="$t('messages')"><fa :icon="['far', 'envelope']"/><i class="indicator" v-if="$store.state.i.hasUnreadSpecifiedNotes"><fa icon="circle"/></i></button>
					<button @click="chooseTag" :title="$t('hashtag')" ref="tagButton"><fa icon="hashtag"/></button>
					<button @click="chooseList" :title="$t('list')" ref="listButton"><fa icon="list"/></button>
				</div>
			</header>
		</component>
	</div>
</div>
</template>

<script lang="ts">
import { defineComponent, getCurrentInstance } from 'vue';
import i18n from '../../../i18n';
import XCore from './timeline.core.vue';
import Menu from '../../../common/views/components/menu.vue';
import { faThumbsUp, faQuestion } from '@fortawesome/free-solid-svg-icons';

export default defineComponent({
	i18n: i18n('desktop/views/components/timeline.vue'),
	components: {
		XCore
	},

	data() {
		return {
			$root: getCurrentInstance() as any,
			src: 'home',
			list: null as any,
			tagTl: null as any,
			enableLocalTimeline: false,
			enableGlobalTimeline: false,
			faThumbsUp, faQuestion,
		};
	},

	computed: {
		options(): any {
			return {
				...(this.src == 'list' ? { list: this.list } : { src: this.src }),
				...(this.src == 'tag' ? { tagTl: this.tagTl } : {}),
				key: this.src == 'list' ? this.list.id : this.src
			}
		}
	},

	watch: {
		src() {
			this.saveSrc();
		},

		list(x) {
			this.saveSrc();
			if (x != null) this.tagTl = null;
		},

		tagTl(x) {
			this.saveSrc();
			if (x != null) this.list = null;
		}
	},

	created() {
		this.$root.getMeta().then((meta: Record<string, any>) => {
			if (!(
				this.enableGlobalTimeline = !meta.disableGlobalTimeline
			) && this.src === 'global') this.src = 'local';
			if (!(
				this.enableLocalTimeline = !meta.disableLocalTimeline
			) && ['local', 'hybrid'].includes(this.src)) this.src = 'home';
		});

		if (this.$store.state.device.tl) {
			this.src = this.$store.state.device.tl.src;
			if (this.src == 'list') {
				this.list = this.$store.state.device.tl.arg;
			} else if (this.src == 'tag') {
				this.tagTl = this.$store.state.device.tl.arg;
			}
		} else if (this.$store.state.i.followingCount == 0) {
			this.src = 'hybrid';
		}
	},

	mounted() {
		document.title = this.$root.instanceName;

		(this.$refs.tl as any).$once('loaded', () => {
			this.$emit('loaded');
		});
	},

	methods: {
		saveSrc() {
			this.$store.commit('device/setTl', {
				src: this.src,
				arg: this.src == 'list' ? this.list : this.tagTl
			});
		},

		focus() {
			(this.$refs.tl as any).focus();
		},

		warp(date) {
			(this.$refs.tl as any).warp(date);
		},

		async chooseList() {
			const lists = await this.$root.api('users/lists/list');

			let menu = [{
				icon: 'plus',
				text: this.$t('add-list'),
				action: () => {
					this.$root.dialog({
						title: this.$t('list-name'),
						input: true
					}).then(async ({ canceled, result: title }) => {
						if (canceled) return;
						const list = await this.$root.api('users/lists/create', {
							title
						});

						this.list = list;
						this.src = 'list';
					});
				}
			}];

			if (lists.length > 0) {
				menu.push(null);
			}

			menu = menu.concat(lists.map(list => ({
				icon: 'list',
				text: list.title,
				action: () => {
					this.list = list;
					this.src = 'list';
				}
			})));

			this.$root.new(Menu, {
				source: this.$refs.listButton,
				items: menu
			});
		},

		chooseTag() {
			let menu = [{
				icon: 'plus',
				text: this.$t('add-tag-timeline'),
				action: () => {
					this.$router.push(`/i/settings/hashtags`);
				}
			}];

			if (this.$store.state.settings.tagTimelines.length > 0) {
				menu.push(null);
			}

			menu = menu.concat(this.$store.state.settings.tagTimelines.map(t => ({
				icon: 'hashtag',
				text: t.title,
				action: () => {
					this.tagTl = t;
					this.src = 'tag';
				}
			})));

			this.$root.new(Menu, {
				source: this.$refs.tagButton,
				items: menu
			});
		}
	}
});
</script>

<style lang="stylus" scoped>
.pwbzawku
	> .form
		margin-bottom 16px
		border-radius 6px
		box-shadow 0 3px 8px rgba(0, 0, 0, 0.2)

	.zahtxcqi
		display flex
		flex-wrap wrap
		padding 0 8px
		z-index 10
		background var(--faceHeader)

		> *
			flex-shrink 0

		> .buttons
			margin-left auto

			> button
				padding 0 8px
				font-size 0.9em
				line-height 42px
				color var(--faceTextButton)

				> .indicator
					position absolute
					top -4px
					right 4px
					font-size 10px
					color var(--notificationIndicator)
					animation blink 1s infinite

				&:hover
					color var(--faceTextButtonHover)

				&[data-active]
					color var(--primary)
					cursor default

					&:before
						content ""
						display block
						position absolute
						bottom 0
						left 0
						width 100%
						height 2px
						background var(--primary)

		> div:not(.buttons)
			padding 0 10px
			line-height 42px
			font-size 12px
			user-select none

			&[data-active]
				color var(--primary)
				cursor default
				font-weight bold

				&:before
					content ""
					display block
					position absolute
					bottom 0
					left -8px
					width calc(100% + 16px)
					height 2px
					background var(--primary)

			&:not([data-active])
				color var(--desktopTimelineSrc)
				cursor pointer

				&:hover
					color var(--desktopTimelineSrcHover)

</style>
