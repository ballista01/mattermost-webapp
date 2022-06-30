// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {Dispatch, bindActionCreators, ActionCreatorsMapObject} from 'redux';

import {getRecentPostsChunkInChannel, makeGetPostsChunkAroundPost, getUnreadPostsChunk, getPost} from 'mattermost-redux/selectors/entities/posts';
import {memoizeResult} from 'mattermost-redux/utils/helpers';
import {Action} from 'mattermost-redux/types/actions';
import {markChannelAsRead, markChannelAsViewed} from 'mattermost-redux/actions/channels';
import {makePreparePostIdsForPostList} from 'mattermost-redux/utils/post_list';
import {RequestStatus} from 'mattermost-redux/constants';

import {updateNewMessagesAtInChannel} from 'actions/global_actions';
import {getLatestPostId} from 'utils/post_utils';
import {
    checkAndSetMobileView,
    loadPosts,
    loadUnreads,
    loadPostsAround,
    syncPostsInChannel,
    loadLatestPosts,
} from 'actions/views/channel';
import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';

import PostList, {Props as PostListProps} from './post_list';

const isFirstLoad = (state: GlobalState, channelId: string) => !state.entities.posts.postsInChannel[channelId];
const memoizedGetLatestPostId = memoizeResult((postIds: string[]) => getLatestPostId(postIds));

// This function is added as a fail safe for the channel sync issue we have.
// When the user switches to a team for the first time we show the channel of previous team and then settle for the right channel after that
// This causes the scroll correction etc an issue because post_list is not mounted for new channel instead it is updated

interface Props {
    focusedPostId?: string;
    unreadChunkTimeStamp: number;
    changeUnreadChunkTimeStamp: (lastViewedAt: number) => void;
    channelId: string;
}

function makeMapStateToProps() {
    const getPostsChunkAroundPost = makeGetPostsChunkAroundPost();
    const preparePostIdsForPostList = makePreparePostIdsForPostList();

    return function mapStateToProps(state: GlobalState, ownProps: Pick<Props, 'focusedPostId' | 'unreadChunkTimeStamp' | 'channelId'>) {
        let latestPostTimeStamp = 0;
        let postIds: string[] | undefined;
        let chunk;
        let atLatestPost = false;
        let atOldestPost = false;
        let formattedPostIds: string[] | undefined;
        const {focusedPostId, unreadChunkTimeStamp, channelId} = ownProps;
        const channelViewState = state.views.channel;
        const lastViewedAt = channelViewState.lastChannelViewTime[channelId];
        const isPrefetchingInProcess = channelViewState.channelPrefetchStatus[channelId] === RequestStatus.STARTED;

        const focusedPost = getPost(state, focusedPostId || '');

        if (focusedPostId && focusedPost !== undefined) {
            chunk = getPostsChunkAroundPost(state, focusedPostId, channelId);
        } else if (unreadChunkTimeStamp) {
            chunk = getUnreadPostsChunk(state, channelId, unreadChunkTimeStamp);
        } else {
            chunk = getRecentPostsChunkInChannel(state, channelId);
        }

        if (chunk) {
            postIds = chunk.order;
            atLatestPost = Boolean(chunk.recent);
            atOldestPost = Boolean(chunk.oldest);
        }

        if (postIds) {
            formattedPostIds = preparePostIdsForPostList(state, {postIds, lastViewedAt, indicateNewMessages: true});
            if (postIds.length) {
                const latestPostId = memoizedGetLatestPostId(postIds);
                const latestPost = getPost(state, latestPostId);
                latestPostTimeStamp = latestPost.create_at;
            }
        }

        return {
            lastViewedAt,
            isFirstLoad: isFirstLoad(state, channelId),
            formattedPostIds,
            atLatestPost,
            atOldestPost,
            latestPostTimeStamp,
            postListIds: postIds,
            hasInaccessiblePosts: true,
            isPrefetchingInProcess,
            isMobileView: getIsMobileView(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, PostListProps['actions']>({
            loadUnreads,
            loadPosts,
            loadLatestPosts,
            loadPostsAround,
            checkAndSetMobileView,
            syncPostsInChannel,
            markChannelAsViewed,
            markChannelAsRead,
            updateNewMessagesAtInChannel,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PostList);
