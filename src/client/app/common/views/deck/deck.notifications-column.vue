<template>
<x-column :name="name" :column="column" :is-stacked="isStacked" :pos="pos" :menu="menu">
	<template #header><fa :icon="['far', 'bell']"/>{{ name }}</template>

	<x-notifications :type="column.notificationType === 'all' ? null : column.notificationType"/>
</x-column>
</template>

<script lang="ts">
import Vue from 'vue';
import i18n from '../../../i18n';
import XColumn from './deck.column.vue';
import XNotifications from './deck.notifications.vue';

export default Vue.extend({
	i18n: i18n(),
	components: {
		XColumn,
		XNotifications
	},

	props: {
		column: {
			type: Object,
			required: true
		},
		isStacked: {
			type: Boolean,
			required: true
		},
		pos: {
			type: Object,
			required: false,
			default: () => {}
		},
	},

	data() {
		return {
			menu: null,
		}
	},

	computed: {
		name(): string {
			if (this.column.name) return this.column.name;
			return this.$t('@deck.notifications');
		}
	},

	created() {
		if (this.column.notificationType == null) {
			this.column.notificationType = 'all';
			this.$store.commit('device/updateDeckColumn', this.column);
		}

		this.menu = [{
			icon: 'cog',
			text: this.$t('@.notification-type'),
			action: () => {
				this.$root.dialog({
					title: this.$t('@.notification-type'),
					type: null,
					select: {
						items: ['all', 'follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'poll_vote', 'poll_finished', 'receiveFollowRequest', 'highlight', 'unreadMessagingMessage'].map(x => ({
							value: x, text: this.$t('@.notification-types.' + x)
						})),
						default: this.column.notificationType,
					},
					showCancelButton: true
				}).then(({ canceled, result: type }) => {
					if (canceled) return;
					this.column.notificationType = type;
					this.$store.commit('device/updateDeckColumn', this.column);
				});
			}
		}];
	},
});
</script>
